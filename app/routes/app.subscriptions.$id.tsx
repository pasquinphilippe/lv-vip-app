import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation, redirect } from "react-router";
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
  const intervalLabel = {
    WEEK: `${intervalCount} semaine(s)`,
    MONTH: `${intervalCount} mois`,
    YEAR: `${intervalCount} an(s)`,
  }[interval] || interval;

  const totalPrice = lines.reduce((sum: number, e: any) => {
    return sum + parseFloat(e.node.currentPrice?.amount || 0) * (e.node.quantity || 1);
  }, 0);

  const statusTones: Record<string, string> = {
    ACTIVE: "success",
    PAUSED: "warning",
    CANCELLED: "critical",
    FAILED: "critical",
  };

  const statusLabels: Record<string, string> = {
    ACTIVE: "Actif",
    PAUSED: "En pause",
    CANCELLED: "Annulé",
    FAILED: "Échoué",
  };

  return (
    <s-page
      heading={`Abonnement - ${customer?.email || "Client"}`}
      backAction={{ url: "/app/subscriptions" }}
    >
      {/* Status Badge */}
      <s-section>
        <s-badge tone={statusTones[subscription.status] || "info"}>
          {statusLabels[subscription.status] || subscription.status}
        </s-badge>
      </s-section>

      {/* Actions */}
      <s-section>
        <s-box display="flex" gap="200">
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
        </s-box>
      </s-section>

      {/* Subscription Details */}
      <s-section heading="Détails">
        <s-card>
          <s-description-list>
            <s-description-list-item term="Fréquence">
              Chaque {intervalLabel}
            </s-description-list-item>
            <s-description-list-item term="Prochaine facturation">
              {formatDate(subscription.nextBillingDate)}
            </s-description-list-item>
            <s-description-list-item term="Créé le">
              {formatDate(subscription.createdAt)}
            </s-description-list-item>
            <s-description-list-item term="Dernier paiement">
              {subscription.lastPaymentStatus || "N/A"}
            </s-description-list-item>
          </s-description-list>
        </s-card>
      </s-section>

      {/* Products */}
      <s-section heading={`Produits (${lines.length})`}>
        <s-card>
          {lines.map((edge: any) => {
            const line = edge.node;
            return (
              <s-box key={line.id} padding="300" display="flex" justify="space-between">
                <s-box>
                  <s-text fontWeight="semibold">{line.title}</s-text>
                  {line.variantTitle && (
                    <s-text variant="bodySm" tone="subdued">{line.variantTitle}</s-text>
                  )}
                </s-box>
                <s-text>
                  {line.quantity} × {formatCurrency(line.currentPrice?.amount, subscription.currencyCode)}
                </s-text>
              </s-box>
            );
          })}
          <s-divider />
          <s-box padding="300" display="flex" justify="space-between">
            <s-text fontWeight="bold">Total par livraison</s-text>
            <s-text fontWeight="bold">{formatCurrency(totalPrice, subscription.currencyCode)}</s-text>
          </s-box>
        </s-card>
      </s-section>

      {/* Customer */}
      <s-section heading="Client">
        <s-card>
          <s-description-list>
            <s-description-list-item term="Nom">
              {customer?.firstName} {customer?.lastName}
            </s-description-list-item>
            <s-description-list-item term="Email">
              {customer?.email}
            </s-description-list-item>
            <s-description-list-item term="Téléphone">
              {customer?.phone || "N/A"}
            </s-description-list-item>
          </s-description-list>
        </s-card>
      </s-section>

      {/* Delivery Address */}
      {address && (
        <s-section heading="Adresse de livraison">
          <s-card>
            <s-box padding="300">
              <s-text>{address.firstName} {address.lastName}</s-text>
              <s-text>{address.address1}</s-text>
              {address.address2 && <s-text>{address.address2}</s-text>}
              <s-text>{address.city}, {address.province} {address.zip}</s-text>
              <s-text>{address.country}</s-text>
            </s-box>
          </s-card>
        </s-section>
      )}

      {/* Payment Method */}
      {paymentMethod && (
        <s-section heading="Mode de paiement">
          <s-card>
            <s-box padding="300">
              <s-text>{paymentMethod.brand} •••• {paymentMethod.lastDigits}</s-text>
              <s-text variant="bodySm" tone="subdued">
                Exp. {paymentMethod.expiryMonth}/{paymentMethod.expiryYear}
              </s-text>
            </s-box>
          </s-card>
        </s-section>
      )}

      {/* Order History */}
      {orders.length > 0 && (
        <s-section heading="Historique des commandes">
          <s-card>
            {orders.map((edge: any) => {
              const order = edge.node;
              return (
                <s-box key={order.id} padding="300" display="flex" justify="space-between">
                  <s-text>{order.name}</s-text>
                  <s-box display="flex" gap="400">
                    <s-text>{formatDate(order.createdAt)}</s-text>
                    <s-text>{formatCurrency(order.totalPriceSet?.shopMoney?.amount)}</s-text>
                  </s-box>
                </s-box>
              );
            })}
          </s-card>
        </s-section>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancel && (
        <s-modal
          open
          heading="Annuler l'abonnement"
          onClose={() => setShowCancel(false)}
          primaryAction={{
            content: "Confirmer l'annulation",
            destructive: true,
            onAction: () => {
              handleAction("cancel");
              setShowCancel(false);
            },
          }}
          secondaryAction={{
            content: "Annuler",
            onAction: () => setShowCancel(false),
          }}
        >
          <s-box padding="400">
            <s-banner tone="warning">
              Cette action est irréversible.
            </s-banner>
            <s-text>
              Êtes-vous sûr de vouloir annuler cet abonnement pour {customer?.email}?
            </s-text>
          </s-box>
        </s-modal>
      )}
    </s-page>
  );
}
