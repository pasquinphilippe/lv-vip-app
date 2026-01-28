import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";

// GraphQL query for subscription contracts
const SUBSCRIPTIONS_QUERY = `
  query SubscriptionContracts($first: Int!, $after: String, $query: String) {
    subscriptionContracts(first: $first, after: $after, query: $query) {
      edges {
        cursor
        node {
          id
          status
          createdAt
          updatedAt
          nextBillingDate
          currencyCode
          customer {
            id
            email
            firstName
            lastName
          }
          lines(first: 5) {
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
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        endCursor
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const after = url.searchParams.get("after") || null;

  let queryFilter = status ? `status:${status}` : null;

  const response = await admin.graphql(SUBSCRIPTIONS_QUERY, {
    variables: {
      first: 20,
      after,
      query: queryFilter,
    },
  });

  const data = await response.json();
  const subscriptions = data.data?.subscriptionContracts?.edges || [];
  const pageInfo = data.data?.subscriptionContracts?.pageInfo || {};

  // Calculate stats
  let activeCount = 0;
  let pausedCount = 0;
  let estimatedMRR = 0;

  for (const edge of subscriptions) {
    const sub = edge.node;
    if (sub.status === "ACTIVE") {
      activeCount++;
      const lines = sub.lines?.edges || [];
      for (const lineEdge of lines) {
        const price = parseFloat(lineEdge.node.currentPrice?.amount || 0);
        const qty = lineEdge.node.quantity || 1;
        const interval = sub.billingPolicy?.interval || "MONTH";
        const intervalCount = sub.billingPolicy?.intervalCount || 1;
        
        let monthlyMultiplier = 1;
        if (interval === "WEEK") monthlyMultiplier = 4 / intervalCount;
        else if (interval === "MONTH") monthlyMultiplier = 1 / intervalCount;
        
        estimatedMRR += price * qty * monthlyMultiplier;
      }
    } else if (sub.status === "PAUSED") {
      pausedCount++;
    }
  }

  return {
    subscriptions,
    pageInfo,
    stats: { activeCount, pausedCount, estimatedMRR },
    filters: { status },
  };
};

export default function SubscriptionsPage() {
  const { subscriptions, pageInfo, stats, filters } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: "CAD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("fr-CA");
  };

  const getStatusBadge = (status: string) => {
    const tones: Record<string, string> = {
      ACTIVE: "success",
      PAUSED: "warning",
      CANCELLED: "critical",
      FAILED: "critical",
    };
    const labels: Record<string, string> = {
      ACTIVE: "Actif",
      PAUSED: "En pause",
      CANCELLED: "Annulé",
      FAILED: "Échoué",
    };
    return <s-badge tone={tones[status] || "info"}>{labels[status] || status}</s-badge>;
  };

  const handleFilterChange = (newStatus: string) => {
    const params = new URLSearchParams(searchParams);
    if (newStatus) {
      params.set("status", newStatus);
    } else {
      params.delete("status");
    }
    params.delete("after");
    setSearchParams(params);
  };

  return (
    <s-page heading="Abonnements" subheading="Gérez les contrats d'abonnement">
      {/* KPI Cards */}
      <s-section>
        <s-box display="flex" gap="400">
          <s-card>
            <s-box padding="400">
              <s-text variant="bodySm" tone="subdued">Actifs</s-text>
              <s-text variant="headingLg" fontWeight="bold">{stats.activeCount}</s-text>
            </s-box>
          </s-card>
          <s-card>
            <s-box padding="400">
              <s-text variant="bodySm" tone="subdued">En pause</s-text>
              <s-text variant="headingLg" fontWeight="bold">{stats.pausedCount}</s-text>
            </s-box>
          </s-card>
          <s-card>
            <s-box padding="400">
              <s-text variant="bodySm" tone="subdued">MRR estimé</s-text>
              <s-text variant="headingLg" fontWeight="bold">{formatCurrency(stats.estimatedMRR)}</s-text>
            </s-box>
          </s-card>
        </s-box>
      </s-section>

      {/* Filters */}
      <s-section>
        <s-box display="flex" gap="200">
          <s-button
            variant={!filters.status ? "primary" : "secondary"}
            onClick={() => handleFilterChange("")}
          >
            Tous
          </s-button>
          <s-button
            variant={filters.status === "ACTIVE" ? "primary" : "secondary"}
            onClick={() => handleFilterChange("ACTIVE")}
          >
            Actifs
          </s-button>
          <s-button
            variant={filters.status === "PAUSED" ? "primary" : "secondary"}
            onClick={() => handleFilterChange("PAUSED")}
          >
            En pause
          </s-button>
          <s-button
            variant={filters.status === "CANCELLED" ? "primary" : "secondary"}
            onClick={() => handleFilterChange("CANCELLED")}
          >
            Annulés
          </s-button>
        </s-box>
      </s-section>

      {/* Subscriptions List */}
      <s-section>
        <s-card>
          {subscriptions.length > 0 ? (
            <s-resource-list>
              {subscriptions.map((edge: any) => {
                const sub = edge.node;
                const customer = sub.customer;
                const lines = sub.lines?.edges || [];
                const firstLine = lines[0]?.node;
                const totalPrice = lines.reduce((sum: number, l: any) => {
                  return sum + parseFloat(l.node.currentPrice?.amount || 0) * (l.node.quantity || 1);
                }, 0);

                return (
                  <s-resource-item key={sub.id} url={`/app/subscriptions/${encodeURIComponent(sub.id)}`}>
                    <s-box display="flex" justify="space-between" align="center">
                      <s-box>
                        <s-text fontWeight="semibold">{customer?.email || "N/A"}</s-text>
                        <s-text variant="bodySm" tone="subdued">
                          {firstLine?.title || "Produit"} {lines.length > 1 && `+${lines.length - 1}`}
                        </s-text>
                      </s-box>
                      <s-box display="flex" gap="400" align="center">
                        {getStatusBadge(sub.status)}
                        <s-text>{formatCurrency(totalPrice)}</s-text>
                        <s-text variant="bodySm" tone="subdued">
                          {formatDate(sub.nextBillingDate)}
                        </s-text>
                      </s-box>
                    </s-box>
                  </s-resource-item>
                );
              })}
            </s-resource-list>
          ) : (
            <s-empty-state heading="Aucun abonnement">
              <s-paragraph>
                Les abonnements apparaîtront ici une fois que vos clients auront souscrit.
              </s-paragraph>
            </s-empty-state>
          )}
        </s-card>
      </s-section>

      {/* Pagination */}
      {pageInfo.hasNextPage && (
        <s-section>
          <s-box display="flex" justify="center">
            <s-button
              onClick={() => {
                const params = new URLSearchParams(searchParams);
                params.set("after", pageInfo.endCursor);
                setSearchParams(params);
              }}
            >
              Charger plus
            </s-button>
          </s-box>
        </s-section>
      )}
    </s-page>
  );
}
