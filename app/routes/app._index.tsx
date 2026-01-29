import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalMembers,
    tierCounts,
    activeSubscriptions,
    pointsToday,
    pointsWeek,
    pointsMonth,
    recentActivity,
    recentRedemptions,
    totalPointsInCirculation,
  ] = await Promise.all([
    prisma.vip_members.count(),
    prisma.vip_members.groupBy({
      by: ["tier"],
      _count: { id: true },
    }),
    prisma.vip_subscriptions.count({
      where: { status: "active" },
    }),
    prisma.loyalty_points_ledger.aggregate({
      _sum: { points: true },
      where: {
        action: { startsWith: "earn" },
        created_at: { gte: startOfToday },
      },
    }),
    prisma.loyalty_points_ledger.aggregate({
      _sum: { points: true },
      where: {
        action: { startsWith: "earn" },
        created_at: { gte: startOfWeek },
      },
    }),
    prisma.loyalty_points_ledger.aggregate({
      _sum: { points: true },
      where: {
        action: { startsWith: "earn" },
        created_at: { gte: startOfMonth },
      },
    }),
    prisma.loyalty_points_ledger.findMany({
      orderBy: { created_at: "desc" },
      take: 10,
      include: {
        member: {
          select: { email: true, first_name: true, last_name: true, tier: true },
        },
      },
    }),
    prisma.loyalty_redemptions.count({
      where: {
        created_at: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.vip_members.aggregate({
      _sum: { points_balance: true },
    }),
  ]);

  const tiers = tierCounts.reduce(
    (acc, { tier, _count }) => {
      acc[tier] = _count.id;
      return acc;
    },
    {} as Record<string, number>,
  );

  const subscriptionBreakdown = await prisma.vip_subscriptions.groupBy({
    by: ["cadence"],
    where: { status: "active" },
    _count: { id: true },
  });

  let estimatedMRR = 0;
  for (const sub of subscriptionBreakdown) {
    const count = sub._count.id;
    const avgPrice = 49;
    const weeksPerCycle =
      sub.cadence === "4_weeks" ? 4 : sub.cadence === "5_weeks" ? 5 : 6;
    const monthlyMultiplier = 4.33 / weeksPerCycle;
    estimatedMRR += count * avgPrice * monthlyMultiplier;
  }

  return {
    totalMembers,
    tiers,
    activeSubscriptions,
    pointsToday: pointsToday._sum.points || 0,
    pointsWeek: pointsWeek._sum.points || 0,
    pointsMonth: pointsMonth._sum.points || 0,
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      action: a.action,
      points: a.points,
      description: a.description,
      createdAt: a.created_at.toISOString(),
      memberEmail: a.member.email,
      memberName: [a.member.first_name, a.member.last_name]
        .filter(Boolean)
        .join(" "),
      memberTier: a.member.tier,
    })),
    recentRedemptions,
    totalPointsInCirculation: totalPointsInCirculation._sum.points_balance || 0,
    estimatedMRR,
  };
};

export default function Index() {
  const data = useLoaderData<typeof loader>();

  const tierLabels: Record<string, string> = {
    LITE: "Lite",
    CLUB: "Club",
    CLUB_PLUS: "Club+",
  };

  const actionLabels: Record<string, string> = {
    earn_purchase: "Achat",
    earn_subscription: "Abonnement",
    earn_milestone: "Niveau",
    earn_referral: "Parrainage",
    earn_birthday: "Anniversaire",
    earn_welcome: "Bienvenue",
    redeem: "Échange",
    expire: "Expiration",
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const formatNumber = (num: number) =>
    new Intl.NumberFormat("fr-CA").format(num);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMs / 3600000);

    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `${diffMin} min`;
    if (diffH < 24) return `${diffH}h`;
    return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
  };

  return (
    <s-page heading="Programme VIP" inlineSize="base">
      <s-button slot="primary-action" variant="primary" href="/app/rewards">
        Gérer les récompenses
      </s-button>
      <s-button slot="secondary-action" href="/app/customers">
        Voir les clients
      </s-button>

      {/* Metrics Cards Row */}
      <s-section padding="base">
        <s-grid
          gridTemplateColumns="@container (inline-size <= 500px) 1fr 1fr, 1fr 1fr 1fr 1fr"
          gap="base"
        >
          {/* Members */}
          <s-clickable
            href="/app/customers"
            paddingBlock="small-400"
            paddingInline="base"
            borderRadius="base"
          >
            <s-stack direction="block" gap="small-200">
              <s-text tone="subdued">Membres VIP</s-text>
              <s-heading>{formatNumber(data.totalMembers)}</s-heading>
              <s-stack direction="inline" gap="small-100">
                <s-badge tone="info">{data.tiers.LITE || 0} Lite</s-badge>
                <s-badge tone="success">{data.tiers.CLUB || 0} Club</s-badge>
              </s-stack>
            </s-stack>
          </s-clickable>

          {/* Subscriptions */}
          <s-clickable
            href="/app/subscriptions"
            paddingBlock="small-400"
            paddingInline="base"
            borderRadius="base"
          >
            <s-stack direction="block" gap="small-200">
              <s-text tone="subdued">Abonnements</s-text>
              <s-heading>{formatNumber(data.activeSubscriptions)}</s-heading>
              <s-text tone="subdued">
                MRR: {formatCurrency(data.estimatedMRR)}
              </s-text>
            </s-stack>
          </s-clickable>

          {/* Points This Month */}
          <s-clickable
            href="/app/loyalty"
            paddingBlock="small-400"
            paddingInline="base"
            borderRadius="base"
          >
            <s-stack direction="block" gap="small-200">
              <s-text tone="subdued">Points ce mois</s-text>
              <s-heading>{formatNumber(data.pointsMonth)}</s-heading>
              <s-stack direction="inline" gap="small-100">
                <s-badge tone="success">+{formatNumber(data.pointsToday)} auj.</s-badge>
              </s-stack>
            </s-stack>
          </s-clickable>

          {/* Points in Circulation */}
          <s-clickable
            href="/app/loyalty"
            paddingBlock="small-400"
            paddingInline="base"
            borderRadius="base"
          >
            <s-stack direction="block" gap="small-200">
              <s-text tone="subdued">En circulation</s-text>
              <s-heading>{formatNumber(data.totalPointsInCirculation)}</s-heading>
              <s-text tone="subdued">
                {data.recentRedemptions} échanges (30j)
              </s-text>
            </s-stack>
          </s-clickable>
        </s-grid>
      </s-section>

      {/* Tier Breakdown */}
      <s-section heading="Répartition">
        <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small-200">
              <s-badge tone="info">Lite</s-badge>
              <s-heading>{data.tiers.LITE || 0}</s-heading>
              <s-text tone="subdued">
                {data.totalMembers > 0
                  ? `${Math.round(((data.tiers.LITE || 0) / data.totalMembers) * 100)}%`
                  : "0%"}
              </s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small-200">
              <s-badge tone="success">Club</s-badge>
              <s-heading>{data.tiers.CLUB || 0}</s-heading>
              <s-text tone="subdued">
                {data.totalMembers > 0
                  ? `${Math.round(((data.tiers.CLUB || 0) / data.totalMembers) * 100)}%`
                  : "0%"}
              </s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small-200">
              <s-badge tone="warning">Club+</s-badge>
              <s-heading>{data.tiers.CLUB_PLUS || 0}</s-heading>
              <s-text tone="subdued">
                {data.totalMembers > 0
                  ? `${Math.round(((data.tiers.CLUB_PLUS || 0) / data.totalMembers) * 100)}%`
                  : "0%"}
              </s-text>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      {/* Recent Activity */}
      <s-section heading="Activité récente" padding="none">
        {data.recentActivity.length > 0 ? (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Client</s-table-header>
              <s-table-header listSlot="secondary">Action</s-table-header>
              <s-table-header format="numeric">Points</s-table-header>
              <s-table-header>Quand</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {data.recentActivity.map((activity) => (
                <s-table-row key={activity.id}>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-200">
                      <s-text>
                        {activity.memberName || activity.memberEmail.split("@")[0]}
                      </s-text>
                      <s-badge
                        tone={
                          activity.memberTier === "CLUB_PLUS"
                            ? "warning"
                            : activity.memberTier === "CLUB"
                            ? "success"
                            : "info"
                        }
                      >
                        {tierLabels[activity.memberTier]}
                      </s-badge>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    {actionLabels[activity.action] || activity.action}
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={activity.points > 0 ? "success" : "critical"}>
                      {activity.points > 0 ? "+" : ""}{activity.points}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text tone="subdued">{formatDate(activity.createdAt)}</s-text>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <s-box padding="large">
            <s-stack direction="block" gap="base">
              <s-heading>Aucune activité</s-heading>
              <s-paragraph>
                L'activité VIP apparaîtra ici dès que vos clients commenceront
                à gagner des points.
              </s-paragraph>
              <s-button variant="primary" href="/app/settings/points">
                Configurer les points
              </s-button>
            </s-stack>
          </s-box>
        )}
      </s-section>

      {/* Sidebar - Quick Links */}
      <s-section slot="aside" heading="Navigation">
        <s-stack direction="block" gap="small-200">
          <s-link href="/app/rewards">Récompenses</s-link>
          <s-link href="/app/customers">Clients VIP</s-link>
          <s-link href="/app/subscriptions">Abonnements</s-link>
          <s-link href="/app/loyalty">Programme</s-link>
          <s-link href="/app/settings">Paramètres</s-link>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Coloration Pro">
        <s-paragraph>
          Programme de fidélité pour lucvincentcoloration.com — points sur
          achats, abonnements et add-ons.
        </s-paragraph>
        <s-stack direction="block" gap="small-200">
          <s-link href="https://lucvincentcoloration.com" target="_blank">
            Voir la boutique →
          </s-link>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
