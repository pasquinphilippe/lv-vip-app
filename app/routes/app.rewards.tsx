import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import React from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const rewards = await prisma.loyalty_rewards.findMany({
    orderBy: [{ is_active: "desc" }, { sort_order: "asc" }, { created_at: "desc" }],
    include: {
      _count: {
        select: { redemptions: true },
      },
    },
  });

  return { rewards };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "create") {
    const name = formData.get("name") as string;
    const name_fr = formData.get("name_fr") as string;
    const type = formData.get("type") as string;
    const points_cost = parseInt(formData.get("points_cost") as string, 10);
    const discount_value = formData.get("discount_value")
      ? parseFloat(formData.get("discount_value") as string)
      : null;
    const discount_type = (formData.get("discount_type") as string) || null;
    const tier_required = (formData.get("tier_required") as string) || null;

    if (!name_fr || !type || !points_cost) {
      return { error: "Nom, type et coût en points requis." };
    }

    await prisma.loyalty_rewards.create({
      data: {
        name: name || name_fr,
        name_fr,
        type,
        points_cost,
        discount_value,
        discount_type,
        tier_required: tier_required || null,
        brand: "coloration",
      },
    });

    return { success: true };
  }

  if (intent === "toggle") {
    const id = formData.get("id") as string;
    const reward = await prisma.loyalty_rewards.findUnique({ where: { id } });
    if (reward) {
      await prisma.loyalty_rewards.update({
        where: { id },
        data: { is_active: !reward.is_active },
      });
    }
    return { success: true };
  }

  if (intent === "delete") {
    const id = formData.get("id") as string;
    const redemptionCount = await prisma.loyalty_redemptions.count({
      where: { reward_id: id },
    });
    if (redemptionCount > 0) {
      await prisma.loyalty_rewards.update({
        where: { id },
        data: { is_active: false },
      });
    } else {
      await prisma.loyalty_rewards.delete({ where: { id } });
    }
    return { success: true };
  }

  return { error: "Action inconnue." };
};

export default function RewardsPage() {
  const { rewards } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  // Toast notifications on action completion
  React.useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.success) {
        shopify.toast.show("Action réussie", { duration: 3000 });
      } else if (fetcher.data.error) {
        shopify.toast.show(fetcher.data.error, { isError: true });
      }
    }
  }, [fetcher.state, fetcher.data]);

  const typeLabels: Record<string, string> = {
    discount: "Rabais $",
    percentage: "Rabais %",
    shipping: "Livraison",
    product: "Produit",
  };

  const tierLabels: Record<string, string> = {
    LITE: "Lite",
    CLUB: "Club",
    CLUB_PLUS: "Club+",
  };

  const isSubmitting = fetcher.state !== "idle";

  const activeRewards = rewards.filter((r) => r.is_active);
  const totalRedemptions = rewards.reduce((sum, r) => sum + (r._count?.redemptions || 0), 0);

  return (
    <s-page heading="Récompenses" inlineSize="base">
      <s-button slot="primary-action" variant="primary" commandFor="create-reward-modal">
        Créer une récompense
      </s-button>

      {/* Stats */}
      <s-section padding="base">
        <s-grid
          gridTemplateColumns="@container (inline-size <= 400px) 1fr, 1fr auto 1fr auto 1fr"
          gap="small-200"
        >
          <s-box paddingBlock="small-400" paddingInline="base">
            <s-stack direction="block" gap="small-200">
              <s-text tone="subdued">Total</s-text>
              <s-heading>{rewards.length}</s-heading>
            </s-stack>
          </s-box>
          <s-divider direction="block" />
          <s-box paddingBlock="small-400" paddingInline="base">
            <s-stack direction="block" gap="small-200">
              <s-text tone="subdued">Actives</s-text>
              <s-heading>{activeRewards.length}</s-heading>
            </s-stack>
          </s-box>
          <s-divider direction="block" />
          <s-box paddingBlock="small-400" paddingInline="base">
            <s-stack direction="block" gap="small-200">
              <s-text tone="subdued">Échanges</s-text>
              <s-heading>{totalRedemptions}</s-heading>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      {/* Rewards Table */}
      <s-section heading="Catalogue" padding="none">
        {rewards.length > 0 ? (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Récompense</s-table-header>
              <s-table-header listSlot="secondary">Type</s-table-header>
              <s-table-header format="numeric">Coût</s-table-header>
              <s-table-header format="numeric">Échanges</s-table-header>
              <s-table-header>Statut</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rewards.map((reward) => (
                <s-table-row key={reward.id}>
                  <s-table-cell>
                    <s-stack direction="block" gap="small-100">
                      <s-text>{reward.name_fr || reward.name}</s-text>
                      {reward.tier_required && (
                        <s-badge tone="warning">
                          {tierLabels[reward.tier_required]} min
                        </s-badge>
                      )}
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-100">
                      <s-text>{typeLabels[reward.type] || reward.type}</s-text>
                      {reward.discount_value && (
                        <s-text tone="subdued">
                          ({reward.discount_type === "percentage"
                            ? `${reward.discount_value}%`
                            : `${reward.discount_value}$`})
                        </s-text>
                      )}
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone="info">{reward.points_cost} pts</s-badge>
                  </s-table-cell>
                  <s-table-cell>{reward._count?.redemptions || 0}</s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-200">
                      <s-badge tone={reward.is_active ? "success" : "critical"}>
                        {reward.is_active ? "Actif" : "Inactif"}
                      </s-badge>
                      <s-button
                        variant="tertiary"
                        size="slim"
                        onClick={() => {
                          fetcher.submit(
                            { intent: "toggle", id: reward.id },
                            { method: "POST" }
                          );
                        }}
                        disabled={isSubmitting}
                      >
                        {reward.is_active ? "Désactiver" : "Activer"}
                      </s-button>
                    </s-stack>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <s-box padding="large">
            <s-stack direction="block" gap="base">
              <s-heading>Aucune récompense</s-heading>
              <s-paragraph>
                Créez votre première récompense pour que vos clients puissent
                échanger leurs points.
              </s-paragraph>
              <s-button variant="primary" commandFor="create-reward-modal">
                Créer une récompense
              </s-button>
            </s-stack>
          </s-box>
        )}
      </s-section>

      {/* Create Modal */}
      <s-modal id="create-reward-modal" heading="Nouvelle récompense">
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="create" />
          <s-stack direction="block" gap="large">
            <s-text-field
              name="name_fr"
              label="Nom de la récompense"
              placeholder="Ex: Livraison gratuite"
              required
            />

            <s-text-field
              name="name"
              label="Nom (anglais, optionnel)"
              placeholder="Ex: Free shipping"
            />

            <s-select name="type" label="Type de récompense" required>
              <s-option value="discount">Rabais en dollars</s-option>
              <s-option value="percentage">Rabais en pourcentage</s-option>
              <s-option value="shipping">Livraison gratuite</s-option>
              <s-option value="product">Produit gratuit</s-option>
            </s-select>

            <s-text-field
              name="points_cost"
              label="Coût en points"
              type="number"
              placeholder="100"
              required
            />

            <s-text-field
              name="discount_value"
              label="Valeur du rabais (optionnel)"
              type="number"
              placeholder="5.00 ou 10"
            />

            <s-select name="discount_type" label="Type de valeur">
              <s-option value="">Non applicable</s-option>
              <s-option value="fixed_amount">Montant fixe ($)</s-option>
              <s-option value="percentage">Pourcentage (%)</s-option>
            </s-select>

            <s-select name="tier_required" label="Niveau requis">
              <s-option value="">Tous les niveaux</s-option>
              <s-option value="CLUB">Club minimum</s-option>
              <s-option value="CLUB_PLUS">Club+ seulement</s-option>
            </s-select>
          </s-stack>

          <s-button slot="primary-action" variant="primary" submit disabled={isSubmitting}>
            {isSubmitting ? "Création..." : "Créer"}
          </s-button>
          <s-button slot="secondary-action" variant="secondary">
            Annuler
          </s-button>
        </fetcher.Form>
      </s-modal>

      {/* Sidebar */}
      <s-section slot="aside" heading="À propos">
        <s-paragraph>
          Les récompenses permettent à vos clients VIP d'échanger leurs points
          contre des rabais. Les codes sont générés automatiquement.
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Types">
        <s-stack direction="block" gap="base">
          <s-stack direction="block" gap="small-100">
            <s-text type="strong">Rabais en $</s-text>
            <s-text tone="subdued">Code pour X$ de rabais</s-text>
          </s-stack>
          <s-stack direction="block" gap="small-100">
            <s-text type="strong">Rabais en %</s-text>
            <s-text tone="subdued">Code pour X% de rabais</s-text>
          </s-stack>
          <s-stack direction="block" gap="small-100">
            <s-text type="strong">Livraison</s-text>
            <s-text tone="subdued">Livraison gratuite</s-text>
          </s-stack>
        </s-stack>
      </s-section>
    </s-page>
  );
}
