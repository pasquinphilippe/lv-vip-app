import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const tier = url.searchParams.get("tier") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = 20;

  // Build filter for VIP members
  const where = tier ? { tier } : {};

  // Get VIP members from database
  const [members, totalCount] = await Promise.all([
    prisma.vip_members.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        subscriptions: {
          where: { status: "active" },
          take: 1,
        },
        _count: {
          select: {
            redemptions: true,
          },
        },
      },
    }),
    prisma.vip_members.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    members,
    pagination: {
      page,
      totalPages,
      totalCount,
    },
    filters: { tier },
  };
};

export default function CustomersPage() {
  const { members, pagination, filters } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const tierLabels: Record<string, string> = {
    LITE: "Lite",
    CLUB: "Club",
    CLUB_PLUS: "Club+",
  };

  const tierColors = {
    LITE: "info",
    CLUB: "success",
    CLUB_PLUS: "warning",
  } as const;

  const handleFilterChange = (tier: string) => {
    const params = new URLSearchParams(searchParams);
    if (tier) {
      params.set("tier", tier);
    } else {
      params.delete("tier");
    }
    params.delete("page");
    setSearchParams(params);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    setSearchParams(params);
  };

  return (
    <s-page heading="Clients VIP">
      {/* Stats */}
      <s-section heading="Aperçu">
        <s-stack direction="inline" gap="large">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Total clients VIP</s-text>
              <s-text type="strong">{pagination.totalCount}</s-text>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      {/* Filters */}
      <s-section heading="Filtres">
        <s-stack direction="inline" gap="base">
          <s-button
            variant={!filters.tier ? "primary" : "secondary"}
            onClick={() => handleFilterChange("")}
          >
            Tous
          </s-button>
          {Object.entries(tierLabels).map(([tier, label]) => (
            <s-button
              key={tier}
              variant={filters.tier === tier ? "primary" : "secondary"}
              onClick={() => handleFilterChange(tier)}
            >
              {label}
            </s-button>
          ))}
        </s-stack>
      </s-section>

      {/* Members List */}
      <s-section heading="Liste des clients">
        {members.length > 0 ? (
          <s-stack direction="block" gap="base">
            {members.map((member) => {
              const hasActiveSubscription = member.subscriptions.length > 0;
              return (
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
                      <s-badge tone={tierColors[member.tier as keyof typeof tierColors] || "info"}>
                        {tierLabels[member.tier] || member.tier}
                      </s-badge>
                      <s-text>{member.points_balance} pts</s-text>
                      {hasActiveSubscription && (
                        <s-badge tone="success">Abonné</s-badge>
                      )}
                      {member._count.redemptions > 0 && (
                        <s-text color="subdued">
                          {member._count.redemptions} échange(s)
                        </s-text>
                      )}
                    </s-stack>
                  </s-stack>
                </s-box>
              );
            })}
          </s-stack>
        ) : (
          <s-box padding="large">
            <s-stack direction="block" gap="base">
              <s-heading>Aucun client VIP</s-heading>
              <s-paragraph>
                Les clients VIP apparaîtront ici une fois qu'ils se seront inscrits au programme.
              </s-paragraph>
            </s-stack>
          </s-box>
        )}
      </s-section>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <s-section>
          <s-stack direction="inline" gap="base">
            {pagination.page > 1 && (
              <s-button onClick={() => handlePageChange(pagination.page - 1)}>
                Précédent
              </s-button>
            )}
            <s-text>
              Page {pagination.page} sur {pagination.totalPages}
            </s-text>
            {pagination.page < pagination.totalPages && (
              <s-button onClick={() => handlePageChange(pagination.page + 1)}>
                Suivant
              </s-button>
            )}
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}
