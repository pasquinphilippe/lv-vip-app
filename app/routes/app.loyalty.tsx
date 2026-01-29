import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // Get VIP member stats
  const [totalMembers, tierCounts, rewardsCount, recentRedemptions] = await Promise.all([
    prisma.vip_members.count(),
    prisma.vip_members.groupBy({
      by: ["tier"],
      _count: { id: true },
    }),
    prisma.loyalty_rewards.count({ where: { is_active: true } }),
    prisma.loyalty_redemptions.count({
      where: {
        created_at: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // last 30 days
        },
      },
    }),
  ]);

  // Get tier breakdown
  const tiers = tierCounts.reduce(
    (acc, { tier, _count }) => {
      acc[tier] = _count.id;
      return acc;
    },
    {} as Record<string, number>
  );

  // Get active rewards
  const rewards = await prisma.loyalty_rewards.findMany({
    where: { is_active: true },
    orderBy: { sort_order: "asc" },
    take: 10,
  });

  // Get top members by points
  const topMembers = await prisma.vip_members.findMany({
    orderBy: { lifetime_points: "desc" },
    take: 5,
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      tier: true,
      points_balance: true,
      lifetime_points: true,
    },
  });

  return {
    stats: {
      totalMembers,
      tiers,
      rewardsCount,
      recentRedemptions,
    },
    rewards,
    topMembers,
  };
};

export default function LoyaltyPage() {
  const { stats, rewards, topMembers } = useLoaderData<typeof loader>();

  const tierLabels: Record<string, string> = {
    LITE: "Lite",
    CLUB: "Club",
    CLUB_PLUS: "Club+",
  };

  const tierColors: Record<string, string> = {
    LITE: "info",
    CLUB: "success",
    CLUB_PLUS: "warning",
  };

  return (
    <s-page heading="Programme VIP">
      {/* Stats */}
      <s-section heading="Statistiques">
        <s-stack direction="inline" gap="large">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Membres VIP</s-text>
              <s-text type="strong">{stats.totalMembers}</s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Récompenses actives</s-text>
              <s-text type="strong">{stats.rewardsCount}</s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Échanges (30j)</s-text>
              <s-text type="strong">{stats.recentRedemptions}</s-text>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      {/* Tier Breakdown */}
      <s-section heading="Répartition par niveau">
        <s-stack direction="inline" gap="base">
          {Object.entries(tierLabels).map(([tier, label]) => (
            <s-box key={tier} padding="base" borderWidth="base" borderRadius="base">
              <s-stack direction="inline" gap="base">
                <s-badge tone={tierColors[tier] as "info" | "success" | "warning"}>
                  {label}
                </s-badge>
                <s-text type="strong">{stats.tiers[tier] || 0}</s-text>
              </s-stack>
            </s-box>
          ))}
        </s-stack>
      </s-section>

      {/* Top Members */}
      <s-section heading="Meilleurs membres">
        {topMembers.length > 0 ? (
          <s-stack direction="block" gap="base">
            {topMembers.map((member) => (
              <s-box
                key={member.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="subdued"
              >
                <s-stack direction="inline" gap="large">
                  <s-stack direction="block" gap="small">
                    <s-text type="strong">
                      {member.first_name} {member.last_name}
                    </s-text>
                    <s-text color="subdued">{member.email}</s-text>
                  </s-stack>
                  <s-stack direction="inline" gap="base">
                    <s-badge tone={tierColors[member.tier] as "info" | "success" | "warning"}>
                      {tierLabels[member.tier] || member.tier}
                    </s-badge>
                    <s-text>{member.points_balance} pts</s-text>
                  </s-stack>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        ) : (
          <s-box padding="large">
            <s-paragraph>Aucun membre VIP pour le moment.</s-paragraph>
          </s-box>
        )}
      </s-section>

      {/* Rewards */}
      <s-section heading="Récompenses disponibles">
        {rewards.length > 0 ? (
          <s-stack direction="block" gap="base">
            {rewards.map((reward) => (
              <s-box
                key={reward.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="inline" gap="large">
                  <s-stack direction="block" gap="small">
                    <s-text type="strong">{reward.name_fr || reward.name}</s-text>
                    {reward.description_fr || reward.description ? (
                      <s-text color="subdued">
                        {reward.description_fr || reward.description}
                      </s-text>
                    ) : null}
                  </s-stack>
                  <s-stack direction="inline" gap="base">
                    <s-badge tone="info">{reward.type}</s-badge>
                    <s-text type="strong">{reward.points_cost} pts</s-text>
                    {reward.tier_required && (
                      <s-badge tone="warning">{tierLabels[reward.tier_required]}</s-badge>
                    )}
                  </s-stack>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        ) : (
          <s-box padding="large">
            <s-paragraph>Aucune récompense configurée.</s-paragraph>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
}
