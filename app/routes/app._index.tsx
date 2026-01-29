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
    // Total VIP members
    prisma.vip_members.count(),

    // Tier breakdown
    prisma.vip_members.groupBy({
      by: ["tier"],
      _count: { id: true },
    }),

    // Active subscriptions
    prisma.vip_subscriptions.count({
      where: { status: "active" },
    }),

    // Points awarded today
    prisma.loyalty_points_ledger.aggregate({
      _sum: { points: true },
      where: {
        action: { startsWith: "earn" },
        created_at: { gte: startOfToday },
      },
    }),

    // Points awarded this week
    prisma.loyalty_points_ledger.aggregate({
      _sum: { points: true },
      where: {
        action: { startsWith: "earn" },
        created_at: { gte: startOfWeek },
      },
    }),

    // Points awarded this month
    prisma.loyalty_points_ledger.aggregate({
      _sum: { points: true },
      where: {
        action: { startsWith: "earn" },
        created_at: { gte: startOfMonth },
      },
    }),

    // Recent activity (last 20 events)
    prisma.loyalty_points_ledger.findMany({
      orderBy: { created_at: "desc" },
      take: 20,
      include: {
        member: {
          select: { email: true, first_name: true, last_name: true, tier: true },
        },
      },
    }),

    // Recent redemptions count (30 days)
    prisma.loyalty_redemptions.count({
      where: {
        created_at: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),

    // Total points in circulation
    prisma.vip_members.aggregate({
      _sum: { points_balance: true },
    }),
  ]);

  // Build tier map
  const tiers = tierCounts.reduce(
    (acc, { tier, _count }) => {
      acc[tier] = _count.id;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Estimate MRR from active subscriptions (rough: avg $49/cycle * 4 weeks)
  // For simplicity, get subscription data
  const subscriptionBreakdown = await prisma.vip_subscriptions.groupBy({
    by: ["cadence"],
    where: { status: "active" },
    _count: { id: true },
  });

  // Estimate MRR based on cadence (Coloration Pro = simpler, $49 avg)
  let estimatedMRR = 0;
  for (const sub of subscriptionBreakdown) {
    const count = sub._count.id;
    const avgPrice = 49; // Coloration Pro avg
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

  const tierColors: Record<string, "info" | "success" | "warning"> = {
    LITE: "info",
    CLUB: "success",
    CLUB_PLUS: "warning",
  };

  const actionLabels: Record<string, string> = {
    earn_purchase: "🛒 Achat",
    earn_subscription: "🔄 Abonnement",
    earn_milestone: "🏆 Passage de niveau",
    earn_referral: "🤝 Parrainage",
    earn_birthday: "🎂 Anniversaire",
    earn_welcome: "👋 Bienvenue",
    redeem: "🎁 Échange",
    expire: "⏰ Expiration",
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: "CAD",
    }).format(amount);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMs / 3600000);

    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffH < 24) return `Il y a ${diffH}h`;
    return d.toLocaleDateString("fr-CA", {
      day: "numeric",
      month: "short",
    });
  };

  return (
    <s-page heading="Tableau de bord VIP">
      {/* Quick Actions */}
      <s-button slot="primary-action" href="/app/rewards">
        Gérer les récompenses
      </s-button>

      {/* KPI Cards Row 1 */}
      <s-section heading="Vue d'ensemble">
        <s-stack direction="inline" gap="large">
          <s-box padding="large" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Membres VIP</s-text>
              <s-text type="strong">{data.totalMembers}</s-text>
            </s-stack>
          </s-box>
          <s-box padding="large" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Abonnements actifs</s-text>
              <s-text type="strong">{data.activeSubscriptions}</s-text>
            </s-stack>
          </s-box>
          <s-box padding="large" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">MRR estimé</s-text>
              <s-text type="strong">
                {formatCurrency(data.estimatedMRR)}
              </s-text>
            </s-stack>
          </s-box>
          <s-box padding="large" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Points en circulation</s-text>
              <s-text type="strong">
                {data.totalPointsInCirculation.toLocaleString("fr-CA")}
              </s-text>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      {/* Tier Breakdown */}
      <s-section heading="Répartition par niveau">
        <s-stack direction="inline" gap="large">
          {(["LITE", "CLUB", "CLUB_PLUS"] as const).map((tier) => (
            <s-box
              key={tier}
              padding="large"
              borderWidth="base"
              borderRadius="base"
            >
              <s-stack direction="block" gap="small">
                <s-badge tone={tierColors[tier]}>{tierLabels[tier]}</s-badge>
                <s-text type="strong">{data.tiers[tier] || 0}</s-text>
                <s-text color="subdued">
                  {data.totalMembers > 0
                    ? `${Math.round(((data.tiers[tier] || 0) / data.totalMembers) * 100)}%`
                    : "0%"}
                </s-text>
              </s-stack>
            </s-box>
          ))}
        </s-stack>
      </s-section>

      {/* Points Activity */}
      <s-section heading="Points attribués">
        <s-stack direction="inline" gap="large">
          <s-box padding="large" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Aujourd'hui</s-text>
              <s-text type="strong">
                {data.pointsToday.toLocaleString("fr-CA")}
              </s-text>
            </s-stack>
          </s-box>
          <s-box padding="large" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Cette semaine</s-text>
              <s-text type="strong">
                {data.pointsWeek.toLocaleString("fr-CA")}
              </s-text>
            </s-stack>
          </s-box>
          <s-box padding="large" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Ce mois</s-text>
              <s-text type="strong">
                {data.pointsMonth.toLocaleString("fr-CA")}
              </s-text>
            </s-stack>
          </s-box>
          <s-box padding="large" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Échanges (30j)</s-text>
              <s-text type="strong">{data.recentRedemptions}</s-text>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      {/* Recent Activity Feed */}
      <s-section heading="Activité récente">
        {data.recentActivity.length > 0 ? (
          <s-stack direction="block" gap="small">
            {data.recentActivity.map((activity) => (
              <s-box
                key={activity.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="subdued"
              >
                <s-stack direction="inline" gap="large">
                  <s-stack direction="block" gap="small">
                    <s-stack direction="inline" gap="base">
                      <s-text type="strong">
                        {activity.memberName || activity.memberEmail}
                      </s-text>
                      <s-badge
                        tone={tierColors[activity.memberTier] || "info"}
                      >
                        {tierLabels[activity.memberTier] || activity.memberTier}
                      </s-badge>
                    </s-stack>
                    <s-text color="subdued">
                      {actionLabels[activity.action] || activity.action}
                      {activity.description ? ` — ${activity.description}` : ""}
                    </s-text>
                  </s-stack>
                  <s-stack direction="inline" gap="base">
                    <s-badge
                      tone={activity.points > 0 ? "success" : "critical"}
                    >
                      {activity.points > 0 ? "+" : ""}
                      {activity.points} pts
                    </s-badge>
                    <s-text color="subdued">
                      {formatDate(activity.createdAt)}
                    </s-text>
                  </s-stack>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        ) : (
          <s-box padding="large">
            <s-stack direction="block" gap="base">
              <s-text type="strong">Aucune activité</s-text>
              <s-paragraph>
                L'activité VIP apparaîtra ici dès que vos clients commenceront
                à gagner et échanger des points.
              </s-paragraph>
            </s-stack>
          </s-box>
        )}
      </s-section>

      {/* Quick Links - Aside */}
      <s-section slot="aside" heading="Accès rapide">
        <s-stack direction="block" gap="base">
          <s-button href="/app/rewards" variant="secondary">
            🎁 Récompenses
          </s-button>
          <s-button href="/app/loyalty" variant="secondary">
            ⭐ Programme VIP
          </s-button>
          <s-button href="/app/subscriptions" variant="secondary">
            🔄 Abonnements
          </s-button>
          <s-button href="/app/customers" variant="secondary">
            👥 Clients
          </s-button>
          <s-button href="/app/settings" variant="secondary">
            ⚙️ Paramètres
          </s-button>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Coloration Pro">
        <s-paragraph>
          Programme de fidélité pour lucvincentcoloration.com — points sur
          achats, abonnements et add-ons.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
