import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  InlineStack,
  Badge,
  Button,
  Modal,
  TextField,
  Select,
  Banner,
  DescriptionList,
  Divider,
  Box,
  DataTable,
  Thumbnail,
  ButtonGroup,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";

// Detailed subscription query
const SUBSCRIPTION_QUERY = `
  query SubscriptionContract($id: ID!) {
    subscriptionContract(id: $id) {
      id
      status
      createdAt
      updatedAt
      nextBillingDate
      currencyCode
      note
      lastPaymentStatus
      lastBillingErrorType
      customer {
        id
        email
        firstName
        lastName
        phone
        defaultAddress {
          address1
          address2
          city
          province
          country
          zip
        }
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
            phone
          }
        }
      }
      deliveryPrice {
        amount
        currencyCode
      }
      lines(first: 20) {
        edges {
          node {
            id
            title
            variantTitle
            variantId
            productId
            quantity
            currentPrice {
              amount
              currencyCode
            }
            variantImage {
              url
              altText
            }
          }
        }
      }
      billingPolicy {
        intervalCount
        interval
        minCycles
        maxCycles
      }
      deliveryPolicy {
        intervalCount
        interval
      }
      orders(first: 10) {
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
            displayFulfillmentStatus
            displayFinancialStatus
          }
        }
      }
      billingAttempts(first: 5) {
        edges {
          node {
            id
            createdAt
            ready
            errorMessage
            order {
              id
              name
            }
          }
        }
      }
    }
  }
`;

// Mutations
const PAUSE_MUTATION = `
  mutation SubscriptionContractPause($subscriptionContractId: ID!) {
    subscriptionContractPause(subscriptionContractId: $subscriptionContractId) {
      contract {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const ACTIVATE_MUTATION = `
  mutation SubscriptionContractActivate($subscriptionContractId: ID!) {
    subscriptionContractActivate(subscriptionContractId: $subscriptionContractId) {
      contract {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const CANCEL_MUTATION = `
  mutation SubscriptionContractCancel($subscriptionContractId: ID!) {
    subscriptionContractCancel(subscriptionContractId: $subscriptionContractId) {
      contract {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const SET_NEXT_BILLING_DATE_MUTATION = `
  mutation SetNextBillingDate($subscriptionContractId: ID!, $date: DateTime!) {
    subscriptionContractSetNextBillingDate(
      subscriptionContractId: $subscriptionContractId
      date: $date
    ) {
      contract {
        id
        nextBillingDate
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    throw new Response("Subscription ID required", { status: 400 });
  }

  const response = await admin.graphql(SUBSCRIPTION_QUERY, {
    variables: { id: decodeURIComponent(id) },
  });

  const data = await response.json();
  const subscription = data.data?.subscriptionContract;

  if (!subscription) {
    throw new Response("Subscription not found", { status: 404 });
  }

  return json({ subscription });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { id } = params;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (!id) {
    return json({ error: "Subscription ID required" }, { status: 400 });
  }

  const subscriptionContractId = decodeURIComponent(id);

  try {
    let mutation: string;
    let variables: Record<string, any> = { subscriptionContractId };

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
      case "setNextBillingDate":
        const date = formData.get("date") as string;
        mutation = SET_NEXT_BILLING_DATE_MUTATION;
        variables = { subscriptionContractId, date };
        break;
      default:
        return json({ error: "Unknown action" }, { status: 400 });
    }

    const response = await admin.graphql(mutation, { variables });
    const result = await response.json();

    // Check for user errors
    const mutationResult = Object.values(result.data || {})[0] as any;
    if (mutationResult?.userErrors?.length > 0) {
      return json({
        error: mutationResult.userErrors.map((e: any) => e.message).join(", "),
      });
    }

    return json({ success: true, intent });
  } catch (error: any) {
    return json({ error: error.message || "An error occurred" });
  }
};

export default function SubscriptionDetailPage() {
  const { subscription } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [newBillingDate, setNewBillingDate] = useState("");

  const isSubmitting = navigation.state === "submitting";

  const handleAction = useCallback(
    (intent: string, additionalData?: Record<string, string>) => {
      const formData = new FormData();
      formData.append("intent", intent);
      if (additionalData) {
        Object.entries(additionalData).forEach(([key, value]) => {
          formData.append(key, value);
        });
      }
      submit(formData, { method: "post" });
    },
    [submit]
  );

  const formatCurrency = (amount: string | number, currency: string = "CAD") => {
    return new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency,
    }).format(Number(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { tone: "success" | "warning" | "critical" | "info"; label: string }> = {
      ACTIVE: { tone: "success", label: "Actif" },
      PAUSED: { tone: "warning", label: "En pause" },
      CANCELLED: { tone: "critical", label: "Annulé" },
      FAILED: { tone: "critical", label: "Échoué" },
      EXPIRED: { tone: "info", label: "Expiré" },
    };
    const config = statusMap[status] || { tone: "info", label: status };
    return <Badge tone={config.tone}>{config.label}</Badge>;
  };

  const customer = subscription.customer;
  const lines = subscription.lines?.edges || [];
  const orders = subscription.orders?.edges || [];
  const billingAttempts = subscription.billingAttempts?.edges || [];
  const paymentMethod = subscription.customerPaymentMethod?.instrument;
  const deliveryAddress = subscription.deliveryMethod?.address;

  const interval = subscription.billingPolicy?.interval || "MONTH";
  const intervalCount = subscription.billingPolicy?.intervalCount || 1;
  const intervalLabel = {
    WEEK: intervalCount === 1 ? "semaine" : `${intervalCount} semaines`,
    MONTH: intervalCount === 1 ? "mois" : `${intervalCount} mois`,
    YEAR: intervalCount === 1 ? "an" : `${intervalCount} ans`,
  }[interval] || interval;

  const totalLinePrice = lines.reduce((sum: number, edge: any) => {
    const line = edge.node;
    return sum + (parseFloat(line.currentPrice?.amount || 0) * (line.quantity || 1));
  }, 0);

  return (
    <Page
      backAction={{ content: "Abonnements", url: "/app/subscriptions" }}
      title={`Abonnement - ${customer?.email || "Client"}`}
      titleMetadata={getStatusBadge(subscription.status)}
      secondaryActions={[
        {
          content: subscription.status === "PAUSED" ? "Réactiver" : "Mettre en pause",
          disabled: !["ACTIVE", "PAUSED"].includes(subscription.status) || isSubmitting,
          onAction: () => {
            handleAction(subscription.status === "PAUSED" ? "activate" : "pause");
          },
        },
        {
          content: "Modifier la date",
          disabled: subscription.status !== "ACTIVE" || isSubmitting,
          onAction: () => setShowDateModal(true),
        },
        {
          content: "Annuler",
          destructive: true,
          disabled: ["CANCELLED", "EXPIRED"].includes(subscription.status) || isSubmitting,
          onAction: () => setShowCancelModal(true),
        },
      ]}
    >
      <Layout>
        {actionData?.error && (
          <Layout.Section>
            <Banner tone="critical" title="Erreur">
              {actionData.error}
            </Banner>
          </Layout.Section>
        )}

        {actionData?.success && (
          <Layout.Section>
            <Banner tone="success" title="Succès">
              L'action a été effectuée avec succès.
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          {/* Subscription Overview */}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Détails de l'abonnement
              </Text>
              <Divider />
              <DescriptionList
                items={[
                  {
                    term: "Fréquence",
                    description: `Chaque ${intervalLabel}`,
                  },
                  {
                    term: "Prochaine facturation",
                    description: subscription.nextBillingDate
                      ? formatDate(subscription.nextBillingDate)
                      : "Non définie",
                  },
                  {
                    term: "Créé le",
                    description: formatDateTime(subscription.createdAt),
                  },
                  {
                    term: "Dernier paiement",
                    description: subscription.lastPaymentStatus || "N/A",
                  },
                ]}
              />
            </BlockStack>
          </Card>

          {/* Line Items */}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Produits ({lines.length})
              </Text>
              <Divider />
              {lines.map((edge: any) => {
                const line = edge.node;
                return (
                  <InlineStack key={line.id} gap="400" blockAlign="center">
                    {line.variantImage?.url && (
                      <Thumbnail
                        source={line.variantImage.url}
                        alt={line.variantImage.altText || line.title}
                        size="small"
                      />
                    )}
                    <BlockStack gap="100">
                      <Text as="span" fontWeight="semibold">
                        {line.title}
                      </Text>
                      {line.variantTitle && (
                        <Text as="span" tone="subdued" variant="bodySm">
                          {line.variantTitle}
                        </Text>
                      )}
                    </BlockStack>
                    <Box>
                      <Text as="span">
                        {line.quantity} × {formatCurrency(line.currentPrice?.amount, subscription.currencyCode)}
                      </Text>
                    </Box>
                  </InlineStack>
                );
              })}
              <Divider />
              <InlineStack align="space-between">
                <Text as="span" fontWeight="semibold">
                  Total par livraison
                </Text>
                <Text as="span" fontWeight="bold">
                  {formatCurrency(totalLinePrice, subscription.currencyCode)}
                </Text>
              </InlineStack>
            </BlockStack>
          </Card>

          {/* Order History */}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Historique des commandes
              </Text>
              <Divider />
              {orders.length > 0 ? (
                <DataTable
                  columnContentTypes={["text", "text", "numeric", "text", "text"]}
                  headings={["Commande", "Date", "Total", "Paiement", "Livraison"]}
                  rows={orders.map((edge: any) => {
                    const order = edge.node;
                    return [
                      order.name,
                      formatDate(order.createdAt),
                      formatCurrency(
                        order.totalPriceSet?.shopMoney?.amount || 0,
                        order.totalPriceSet?.shopMoney?.currencyCode
                      ),
                      order.displayFinancialStatus,
                      order.displayFulfillmentStatus,
                    ];
                  })}
                />
              ) : (
                <Text as="p" tone="subdued">
                  Aucune commande pour cet abonnement.
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          {/* Customer Info */}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Client
              </Text>
              <Divider />
              <DescriptionList
                items={[
                  {
                    term: "Nom",
                    description: `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim() || "N/A",
                  },
                  {
                    term: "Email",
                    description: customer?.email || "N/A",
                  },
                  {
                    term: "Téléphone",
                    description: customer?.phone || "N/A",
                  },
                ]}
              />
            </BlockStack>
          </Card>

          {/* Delivery Address */}
          {deliveryAddress && (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Adresse de livraison
                </Text>
                <Divider />
                <Text as="p">
                  {deliveryAddress.firstName} {deliveryAddress.lastName}
                  <br />
                  {deliveryAddress.address1}
                  {deliveryAddress.address2 && <><br />{deliveryAddress.address2}</>}
                  <br />
                  {deliveryAddress.city}, {deliveryAddress.province} {deliveryAddress.zip}
                  <br />
                  {deliveryAddress.country}
                </Text>
              </BlockStack>
            </Card>
          )}

          {/* Payment Method */}
          {paymentMethod && (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Mode de paiement
                </Text>
                <Divider />
                <Text as="p">
                  {paymentMethod.brand} •••• {paymentMethod.lastDigits}
                  <br />
                  Exp. {paymentMethod.expiryMonth}/{paymentMethod.expiryYear}
                </Text>
              </BlockStack>
            </Card>
          )}
        </Layout.Section>
      </Layout>

      {/* Cancel Modal */}
      <Modal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Annuler l'abonnement"
        primaryAction={{
          content: "Confirmer l'annulation",
          destructive: true,
          loading: isSubmitting,
          onAction: () => {
            handleAction("cancel");
            setShowCancelModal(false);
          },
        }}
        secondaryActions={[
          {
            content: "Annuler",
            onAction: () => setShowCancelModal(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Banner tone="warning">
              Cette action est irréversible. Le client devra créer un nouvel abonnement s'il souhaite reprendre.
            </Banner>
            <Text as="p">
              Êtes-vous sûr de vouloir annuler cet abonnement pour{" "}
              <strong>{customer?.email}</strong>?
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Change Billing Date Modal */}
      <Modal
        open={showDateModal}
        onClose={() => setShowDateModal(false)}
        title="Modifier la date de facturation"
        primaryAction={{
          content: "Enregistrer",
          loading: isSubmitting,
          disabled: !newBillingDate,
          onAction: () => {
            handleAction("setNextBillingDate", { date: new Date(newBillingDate).toISOString() });
            setShowDateModal(false);
            setNewBillingDate("");
          },
        }}
        secondaryActions={[
          {
            content: "Annuler",
            onAction: () => {
              setShowDateModal(false);
              setNewBillingDate("");
            },
          },
        ]}
      >
        <Modal.Section>
          <TextField
            label="Nouvelle date de facturation"
            type="date"
            value={newBillingDate}
            onChange={setNewBillingDate}
            autoComplete="off"
            helpText="La prochaine facturation aura lieu à cette date."
          />
        </Modal.Section>
      </Modal>
    </Page>
  );
}
