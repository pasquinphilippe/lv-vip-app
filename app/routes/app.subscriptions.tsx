import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  InlineGrid,
  Box,
  Badge,
  DataTable,
  Pagination,
  Filters,
  ChoiceList,
  Button,
  EmptyState,
  InlineStack,
  Tooltip,
  Icon,
} from "@shopify/polaris";
import { 
  RefreshIcon,
  CalendarIcon,
} from "@shopify/polaris-icons";
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
          deliveryPrice {
            amount
            currencyCode
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
          lastPaymentStatus
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

// KPI aggregation query
const KPI_QUERY = `
  query SubscriptionKPIs {
    activeContracts: subscriptionContracts(first: 1, query: "status:ACTIVE") {
      edges { node { id } }
      pageInfo { hasNextPage }
    }
    pausedContracts: subscriptionContracts(first: 1, query: "status:PAUSED") {
      edges { node { id } }
      pageInfo { hasNextPage }
    }
    cancelledContracts: subscriptionContracts(first: 1, query: "status:CANCELLED") {
      edges { node { id } }
      pageInfo { hasNextPage }
    }
    failedContracts: subscriptionContracts(first: 1, query: "status:FAILED") {
      edges { node { id } }
      pageInfo { hasNextPage }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const after = url.searchParams.get("after") || null;
  const pageSize = 20;

  // Build query filter
  let queryFilter = "";
  if (status) {
    queryFilter = `status:${status}`;
  }

  // Fetch subscriptions
  const subscriptionsResponse = await admin.graphql(SUBSCRIPTIONS_QUERY, {
    variables: {
      first: pageSize,
      after,
      query: queryFilter || null,
    },
  });
  const subscriptionsData = await subscriptionsResponse.json();

  // Fetch KPIs (counts by status)
  const kpiResponse = await admin.graphql(KPI_QUERY);
  const kpiData = await kpiResponse.json();

  // Calculate MRR from active subscriptions
  // For now, we'll estimate from the first page
  let estimatedMRR = 0;
  const activeContracts = subscriptionsData.data?.subscriptionContracts?.edges || [];
  
  for (const edge of activeContracts) {
    const contract = edge.node;
    if (contract.status === "ACTIVE") {
      const lines = contract.lines?.edges || [];
      for (const lineEdge of lines) {
        const line = lineEdge.node;
        const price = parseFloat(line.currentPrice?.amount || 0);
        const quantity = line.quantity || 1;
        
        // Normalize to monthly
        const interval = contract.billingPolicy?.interval || "MONTH";
        const intervalCount = contract.billingPolicy?.intervalCount || 1;
        
        let monthlyMultiplier = 1;
        if (interval === "WEEK") {
          monthlyMultiplier = 4 / intervalCount;
        } else if (interval === "MONTH") {
          monthlyMultiplier = 1 / intervalCount;
        } else if (interval === "YEAR") {
          monthlyMultiplier = 1 / (12 * intervalCount);
        }
        
        estimatedMRR += price * quantity * monthlyMultiplier;
      }
    }
  }

  return json({
    subscriptions: subscriptionsData.data?.subscriptionContracts?.edges || [],
    pageInfo: subscriptionsData.data?.subscriptionContracts?.pageInfo || {},
    kpis: {
      active: kpiData.data?.activeContracts?.edges?.length || 0,
      paused: kpiData.data?.pausedContracts?.edges?.length || 0,
      cancelled: kpiData.data?.cancelledContracts?.edges?.length || 0,
      failed: kpiData.data?.failedContracts?.edges?.length || 0,
      estimatedMRR,
    },
    filters: { status },
  });
};

export default function SubscriptionsPage() {
  const { subscriptions, pageInfo, kpis, filters } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusOptions = [
    { label: "Tous", value: "" },
    { label: "Actif", value: "ACTIVE" },
    { label: "En pause", value: "PAUSED" },
    { label: "Échoué", value: "FAILED" },
    { label: "Annulé", value: "CANCELLED" },
  ];

  const handleStatusChange = (value: string[]) => {
    const newParams = new URLSearchParams(searchParams);
    if (value[0]) {
      newParams.set("status", value[0]);
    } else {
      newParams.delete("status");
    }
    newParams.delete("after");
    setSearchParams(newParams);
  };

  const handleNextPage = () => {
    if (pageInfo.hasNextPage && pageInfo.endCursor) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("after", pageInfo.endCursor);
      setSearchParams(newParams);
    }
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

  const formatCurrency = (amount: string | number, currency: string = "CAD") => {
    return new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency,
    }).format(Number(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const rows = subscriptions.map((edge: any) => {
    const sub = edge.node;
    const customer = sub.customer;
    const lines = sub.lines?.edges || [];
    const firstLine = lines[0]?.node;
    
    const totalPrice = lines.reduce((sum: number, l: any) => {
      return sum + (parseFloat(l.node.currentPrice?.amount || 0) * (l.node.quantity || 1));
    }, 0);

    const interval = sub.billingPolicy?.interval || "MONTH";
    const intervalCount = sub.billingPolicy?.intervalCount || 1;
    const intervalLabel = {
      WEEK: intervalCount === 1 ? "semaine" : "semaines",
      MONTH: "mois",
      YEAR: intervalCount === 1 ? "an" : "ans",
    }[interval] || interval;

    return [
      <Link to={`/app/subscriptions/${encodeURIComponent(sub.id)}`} key={sub.id}>
        <Text as="span" fontWeight="semibold">
          {customer?.email || "N/A"}
        </Text>
        <br />
        <Text as="span" tone="subdued" variant="bodySm">
          {customer?.firstName} {customer?.lastName}
        </Text>
      </Link>,
      <BlockStack gap="100" key={`${sub.id}-products`}>
        <Text as="span">{firstLine?.title || "N/A"}</Text>
        {lines.length > 1 && (
          <Text as="span" tone="subdued" variant="bodySm">
            +{lines.length - 1} autre(s)
          </Text>
        )}
      </BlockStack>,
      getStatusBadge(sub.status),
      `${intervalCount} ${intervalLabel}`,
      formatCurrency(totalPrice, sub.currencyCode),
      sub.nextBillingDate ? formatDate(sub.nextBillingDate) : "—",
      <Button
        key={`${sub.id}-action`}
        url={`/app/subscriptions/${encodeURIComponent(sub.id)}`}
        size="slim"
      >
        Gérer
      </Button>,
    ];
  });

  return (
    <Page
      title="Abonnements"
      subtitle="Gérez les contrats d'abonnement de vos clients"
      primaryAction={{
        content: "Actualiser",
        icon: RefreshIcon,
        onAction: () => window.location.reload(),
      }}
    >
      <BlockStack gap="500">
        {/* KPI Cards */}
        <InlineGrid columns={{ xs: 2, sm: 4, md: 5 }} gap="400">
          <KPICard
            title="Actifs"
            value={kpis.active}
            tone="success"
          />
          <KPICard
            title="En pause"
            value={kpis.paused}
            tone="warning"
          />
          <KPICard
            title="Échoués"
            value={kpis.failed}
            tone="critical"
          />
          <KPICard
            title="Annulés"
            value={kpis.cancelled}
            tone="subdued"
          />
          <KPICard
            title="MRR estimé"
            value={formatCurrency(kpis.estimatedMRR)}
            tone="magic"
          />
        </InlineGrid>

        {/* Filters */}
        <Card>
          <Filters
            queryValue=""
            filters={[
              {
                key: "status",
                label: "Statut",
                filter: (
                  <ChoiceList
                    title="Statut"
                    titleHidden
                    choices={statusOptions}
                    selected={[filters.status]}
                    onChange={handleStatusChange}
                  />
                ),
                shortcut: true,
              },
            ]}
            onQueryChange={() => {}}
            onQueryClear={() => {}}
            onClearAll={() => {
              setSearchParams(new URLSearchParams());
            }}
          />
        </Card>

        {/* Subscriptions Table */}
        <Card>
          {subscriptions.length > 0 ? (
            <BlockStack gap="400">
              <DataTable
                columnContentTypes={["text", "text", "text", "text", "numeric", "text", "text"]}
                headings={[
                  "Client",
                  "Produits",
                  "Statut",
                  "Fréquence",
                  "Prix",
                  "Prochaine facturation",
                  "",
                ]}
                rows={rows}
              />
              
              <Box padding="400">
                <InlineStack align="center">
                  <Pagination
                    hasPrevious={pageInfo.hasPreviousPage}
                    hasNext={pageInfo.hasNextPage}
                    onNext={handleNextPage}
                    onPrevious={() => {
                      // Handle previous page
                    }}
                  />
                </InlineStack>
              </Box>
            </BlockStack>
          ) : (
            <EmptyState
              heading="Aucun abonnement trouvé"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                {filters.status
                  ? "Aucun abonnement ne correspond aux filtres sélectionnés."
                  : "Vos abonnements apparaîtront ici une fois que les clients auront souscrit."}
              </p>
            </EmptyState>
          )}
        </Card>
      </BlockStack>
    </Page>
  );
}

function KPICard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string | number;
  tone: "success" | "warning" | "critical" | "subdued" | "magic";
}) {
  const toneColors: Record<string, string> = {
    success: "var(--p-color-bg-fill-success)",
    warning: "var(--p-color-bg-fill-warning)",
    critical: "var(--p-color-bg-fill-critical)",
    subdued: "var(--p-color-bg-fill-secondary)",
    magic: "var(--p-color-bg-fill-magic)",
  };

  return (
    <Card>
      <BlockStack gap="200">
        <Text as="p" variant="bodySm" tone="subdued">
          {title}
        </Text>
        <Text as="p" variant="headingLg" fontWeight="bold">
          {value}
        </Text>
      </BlockStack>
    </Card>
  );
}
