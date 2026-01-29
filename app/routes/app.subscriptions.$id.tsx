import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
import { useState } from "react";
import { authenticate } from "../shopify.server";

const SUBSCRIPTION_QUERY = `
  query SubscriptionContract($id: ID!) {
    subscriptionContract(id: $id) {
      id
      status
      createdAt
      nextBillingDate
      currencyCode
      lastPaymentStatus
      customer {
        id
        email
        firstName
        lastName
        phone
      }
      customerPaymentMethod {
        id
        instrument {
          ... on CustomerCreditCard {
            brand
            lastDigits
            expiryMonth
            expiryYear
          }
        }
      }
      deliveryMethod {
        ... on SubscriptionDeliveryMethodShipping {
          address {
            firstName
            lastName
            address1
            address2
            city
            province
            country
            zip
          }
        }
      }
      lines(first: 20) {
        edges {
          node {
            id
            title
            variantTitle
            quantity
            currentPrice {
              amount
              currencyCode
            }
          }
        }
      }
      billingPolicy {
        intervalCount
        interval
      }
      orders(first: 5) {
        edges {
          node {
            id
            name
            createdAt
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  }
`;

const PAUSE_MUTATION = `
  mutation SubscriptionContractPause($subscriptionContractId: ID!) {
    subscriptionContractPause(subscriptionContractId: $subscriptionContractId) {
      contract { id status }
      userErrors { field message }
    }
  }
`;

const ACTIVATE_MUTATION = `
  mutation SubscriptionContractActivate($subscriptionContractId: ID!) {
    subscriptionContractActivate(subscriptionContractId: $subscriptionContractId) {
      contract { id status }
      userErrors { field message }
    }
  }
`;

const CANCEL_MUTATION = `
  mutation SubscriptionContractCancel($subscriptionContractId: ID!) {
    subscriptionContractCancel(subscriptionContractId: $subscriptionContractId) {
      contract { id status }
      userErrors { field message }
    }
  }
`;

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { id } = params;

  if (!id) throw new Response("ID required", { status: 400 });

  const response = await admin.graphql(SUBSCRIPTION_QUERY, {
    variables: { id: decodeURIComponent(id) },
  });

  const data = await response.json();
  const subscription = data.data?.subscriptionContract;

  if (!subscription) throw new Response("Not found", { status: 404 });

  return { subscription };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { id } = params;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (!id) return { error: "ID required" };

  const subscriptionContractId = decodeURIComponent(id);
  let mutation: string;

  switch (intent) {
    case "pause":
      mutation = PAUSE_MUTATION;
      break;
    case "activate":
      mutation = ACTIVATE_MUTATION;
      break;
    case "cancel":
      mutation = CANCEL_MUTATION;
      break;
    default:
      return { error: "Unknown action" };
  }

  const response = await admin.graphql(mutation, {
    variables: { subscriptionContractId },
  });

  const result = await response.json();
  const mutationResult = Object.values(result.data || {})[0] as any;

  if (mutationResult?.userErrors?.length > 0) {
    return { error: mutationResult.userErrors.map((e: any) => e.message).join(", ") };
  }

  return { success: true, intent };
};

export default function SubscriptionDetailPage() {
  const { subscription } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const [showCancel, setShowCancel] = useState(false);

  const isSubmitting = navigation.state === "submitting";

  const handleAction = (intent: string) => {
    const formData = new FormData();
    formData.append("intent", intent);
    submit(formData, { method: "post" });
  };

  const formatCurrency = (amount: string | number, currency = "CAD") => {
    return new Intl.NumberFormat("fr-CA", { style: "currency", currency }).format(Number(amount));
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("fr-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const customer = subscription.customer;
  const lines = subscription.lines?.edges || [];
  const orders = subscription.orders?.edges || [];
  const paymentMethod = subscription.customerPaymentMethod?.instrument;
  const address = subscription.deliveryMethod?.address;

  const interval = subscription.billingPolicy?.interval || "MONTH";
  const intervalCount = subscription.billingPolicy?.intervalCount || 1;
  const intervalLabels: Record<string, string> = {
    WEEK: `${intervalCount} semaine(s)`,
    MONTH: `${intervalCount} mois`,
    YEAR: `${intervalCount} an(s)`,
  };
  const intervalLabel = intervalLabels[interval] || interval;

  const totalPrice = lines.reduce((sum: number, e: any) => {
    return sum + parseFloat(e.node.currentPrice?.amount || 0) * (e.node.quantity || 1);
  }, 0);

  const statusTones = {
    ACTIVE: "success",
    PAUSED: "warning",
    CANCELLED: "critical",
    FAILED: "critical",
  } as const;

  const statusLabels: Record<string, string> = {
    ACTIVE: "Actif",
    PAUSED: "En pause",
    CANCELLED: "Annulé",
    FAILED: "Échoué",
  };

  const getTone = (status: string) => {
    return statusTones[status as keyof typeof statusTones] || "info";
  };

  return (
    <s-page heading={`Abonnement - ${customer?.email || "Client"}`}>
      <s-button slot="breadcrumb-actions" href="/app/subscriptions" variant="tertiary">
        ← Retour
      </s-button>

      {/* Status Badge */}
      <s-section heading="Statut">
        <s-badge tone={getTone(subscription.status)}>
          {statusLabels[subscription.status] || subscription.status}
        </s-badge>
      </s-section>

      {/* Actions */}
      <s-section heading="Actions">
        <s-stack direction="inline" gap="base">
          {subscription.status === "ACTIVE" && (
            <s-button onClick={() => handleAction("pause")} disabled={isSubmitting}>
              Mettre en pause
            </s-button>
          )}
          {subscription.status === "PAUSED" && (
            <s-button variant="primary" onClick={() => handleAction("activate")} disabled={isSubmitting}>
              Réactiver
            </s-button>
          )}
          {!["CANCELLED", "EXPIRED"].includes(subscription.status) && (
            <s-button tone="critical" onClick={() => setShowCancel(true)} disabled={isSubmitting}>
              Annuler
            </s-button>
          )}
        </s-stack>
      </s-section>

      {/* Subscription Details */}
      <s-section heading="Détails">
        <s-stack direction="block" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text type="strong">Fréquence</s-text>
              <s-text>Chaque {intervalLabel}</s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text type="strong">Prochaine facturation</s-text>
              <s-text>{formatDate(subscription.nextBillingDate)}</s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text type="strong">Créé le</s-text>
              <s-text>{formatDate(subscription.createdAt)}</s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text type="strong">Dernier paiement</s-text>
              <s-text>{subscription.lastPaymentStatus || "N/A"}</s-text>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      {/* Products */}
      <s-section heading={`Produits (${lines.length})`}>
        <s-stack direction="block" gap="base">
          {lines.map((edge: any) => {
            const line = edge.node;
            return (
              <s-box key={line.id} padding="base" borderWidth="base" borderRadius="base">
                <s-stack direction="inline" gap="large">
                  <s-stack direction="block" gap="small">
                    <s-text type="strong">{line.title}</s-text>
                    {line.variantTitle && (
                      <s-text color="subdued">{line.variantTitle}</s-text>
                    )}
                  </s-stack>
                  <s-text>
                    {line.quantity} × {formatCurrency(line.currentPrice?.amount, subscription.currencyCode)}
                  </s-text>
                </s-stack>
              </s-box>
            );
          })}
          <s-divider />
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="inline" gap="large">
              <s-text type="strong">Total par livraison</s-text>
              <s-text type="strong">{formatCurrency(totalPrice, subscription.currencyCode)}</s-text>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      {/* Customer */}
      <s-section heading="Client">
        <s-stack direction="block" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text type="strong">Nom</s-text>
              <s-text>{customer?.firstName} {customer?.lastName}</s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text type="strong">Email</s-text>
              <s-text>{customer?.email}</s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text type="strong">Téléphone</s-text>
              <s-text>{customer?.phone || "N/A"}</s-text>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      {/* Delivery Address */}
      {address && (
        <s-section heading="Adresse de livraison">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text>{address.firstName} {address.lastName}</s-text>
              <s-text>{address.address1}</s-text>
              {address.address2 && <s-text>{address.address2}</s-text>}
              <s-text>{address.city}, {address.province} {address.zip}</s-text>
              <s-text>{address.country}</s-text>
            </s-stack>
          </s-box>
        </s-section>
      )}

      {/* Payment Method */}
      {paymentMethod && (
        <s-section heading="Mode de paiement">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text>{paymentMethod.brand} •••• {paymentMethod.lastDigits}</s-text>
              <s-text color="subdued">
                Exp. {paymentMethod.expiryMonth}/{paymentMethod.expiryYear}
              </s-text>
            </s-stack>
          </s-box>
        </s-section>
      )}

      {/* Order History */}
      {orders.length > 0 && (
        <s-section heading="Historique des commandes">
          <s-stack direction="block" gap="base">
            {orders.map((edge: any) => {
              const order = edge.node;
              return (
                <s-box key={order.id} padding="base" borderWidth="base" borderRadius="base">
                  <s-stack direction="inline" gap="large">
                    <s-text type="strong">{order.name}</s-text>
                    <s-text>{formatDate(order.createdAt)}</s-text>
                    <s-text>{formatCurrency(order.totalPriceSet?.shopMoney?.amount)}</s-text>
                  </s-stack>
                </s-box>
              );
            })}
          </s-stack>
        </s-section>
      )}

      {/* Cancel Confirmation - using banner instead of modal */}
      {showCancel && (
        <s-section>
          <s-banner tone="warning" heading="Confirmer l'annulation">
            <s-paragraph>
              Êtes-vous sûr de vouloir annuler cet abonnement pour {customer?.email}?
              Cette action est irréversible.
            </s-paragraph>
            <s-stack direction="inline" gap="base">
              <s-button
                tone="critical"
                onClick={() => {
                  handleAction("cancel");
                  setShowCancel(false);
                }}
              >
                Confirmer l'annulation
              </s-button>
              <s-button variant="secondary" onClick={() => setShowCancel(false)}>
                Annuler
              </s-button>
            </s-stack>
          </s-banner>
        </s-section>
      )}
    </s-page>
  );
}
