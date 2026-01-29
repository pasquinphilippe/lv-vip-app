import { useState } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const rewards = await prisma.loyalty_rewards.findMany({
    orderBy: [{ sort_order: "asc" }, { created_at: "desc" }],
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
    const description = (formData.get("description") as string) || null;
    const description_fr = (formData.get("description_fr") as string) || null;
    const type = formData.get("type") as string;
    const points_cost = parseInt(formData.get("points_cost") as string, 10);
    const discount_value = formData.get("discount_value")
      ? parseFloat(formData.get("discount_value") as string)
      : null;
    const discount_type = (formData.get("discount_type") as string) || null;
    const brand = (formData.get("brand") as string) || "both";
    const tier_required = (formData.get("tier_required") as string) || null;
    const stock_limited = formData.get("stock_limited") === "true";
    const stock_count = formData.get("stock_count")
      ? parseInt(formData.get("stock_count") as string, 10)
      : null;

    if (!name || !type || !points_cost) {
      return { error: "Nom, type et coût en points requis." };
    }

    await prisma.loyalty_rewards.create({
      data: {
        name,
        name_fr: name_fr || null,
        description,
        description_fr,
        type,
        points_cost,
        discount_value,
        discount_type,
        brand,
        tier_required: tier_required || null,
        stock_limited,
        stock_count: stock_limited ? stock_count : null,
      },
    });

    return { success: true, message: "Récompense créée avec succès." };
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
    // Check if reward has redemptions
    const redemptionCount = await prisma.loyalty_redemptions.count({
      where: { reward_id: id },
    });
    if (redemptionCount > 0) {
      // Soft delete: deactivate instead
      await prisma.loyalty_rewards.update({
        where: { id },
        data: { is_active: false },
      });
      return {
        success: true,
        message: "Récompense désactivée (des échanges existent).",
      };
    }
    await prisma.loyalty_rewards.delete({ where: { id } });
    return { success: true, message: "Récompense supprimée." };
  }

  return { error: "Action inconnue." };
};

export default function RewardsPage() {
  const { rewards } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [showForm, setShowForm] = useState(false);

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

  const typeLabels: Record<string, string> = {
    discount: "Rabais",
    shipping: "Livraison",
    product: "Produit",
    add_on: "Add-on",
    experience: "Expérience",
    exclusive: "Exclusif",
  };

  const isSubmitting =
    fetcher.state === "submitting" || fetcher.state === "loading";

  return (
    <s-page heading="Récompenses">
      <s-button
        slot="primary-action"
        onClick={() => setShowForm(!showForm)}
        variant="primary"
      >
        {showForm ? "Annuler" : "Ajouter une récompense"}
      </s-button>

      {/* Create Form */}
      {showForm && (
        <s-section heading="Nouvelle récompense">
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="create" />
            <s-stack direction="block" gap="large">
              {/* Names */}
              <s-stack direction="inline" gap="base">
                <s-box padding="base" borderWidth="base" borderRadius="base">
                  <s-stack direction="block" gap="small">
                    <label htmlFor="name">
                      <s-text type="strong">Nom (EN)</s-text>
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      placeholder="Free Shipping"
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    />
                  </s-stack>
                </s-box>
                <s-box padding="base" borderWidth="base" borderRadius="base">
                  <s-stack direction="block" gap="small">
                    <label htmlFor="name_fr">
                      <s-text type="strong">Nom (FR)</s-text>
                    </label>
                    <input
                      id="name_fr"
                      name="name_fr"
                      type="text"
                      required
                      placeholder="Livraison gratuite"
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    />
                  </s-stack>
                </s-box>
              </s-stack>

              {/* Descriptions */}
              <s-stack direction="inline" gap="base">
                <s-box padding="base" borderWidth="base" borderRadius="base">
                  <s-stack direction="block" gap="small">
                    <label htmlFor="description">
                      <s-text type="strong">Description (EN)</s-text>
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      rows={2}
                      placeholder="Optional description"
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    />
                  </s-stack>
                </s-box>
                <s-box padding="base" borderWidth="base" borderRadius="base">
                  <s-stack direction="block" gap="small">
                    <label htmlFor="description_fr">
                      <s-text type="strong">Description (FR)</s-text>
                    </label>
                    <textarea
                      id="description_fr"
                      name="description_fr"
                      rows={2}
                      placeholder="Description optionnelle"
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    />
                  </s-stack>
                </s-box>
              </s-stack>

              {/* Type, Points, Value */}
              <s-stack direction="inline" gap="base">
                <s-box padding="base" borderWidth="base" borderRadius="base">
                  <s-stack direction="block" gap="small">
                    <label htmlFor="type">
                      <s-text type="strong">Type</s-text>
                    </label>
                    <select
                      id="type"
                      name="type"
                      required
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    >
                      <option value="discount">Rabais</option>
                      <option value="shipping">Livraison</option>
                      <option value="product">Produit</option>
                      <option value="add_on">Add-on</option>
                      <option value="experience">Expérience</option>
                      <option value="exclusive">Exclusif</option>
                    </select>
                  </s-stack>
                </s-box>
                <s-box padding="base" borderWidth="base" borderRadius="base">
                  <s-stack direction="block" gap="small">
                    <label htmlFor="points_cost">
                      <s-text type="strong">Coût en points</s-text>
                    </label>
                    <input
                      id="points_cost"
                      name="points_cost"
                      type="number"
                      required
                      min="1"
                      placeholder="100"
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    />
                  </s-stack>
                </s-box>
                <s-box padding="base" borderWidth="base" borderRadius="base">
                  <s-stack direction="block" gap="small">
                    <label htmlFor="discount_value">
                      <s-text type="strong">Valeur du rabais ($)</s-text>
                    </label>
                    <input
                      id="discount_value"
                      name="discount_value"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="5.00"
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    />
                  </s-stack>
                </s-box>
              </s-stack>

              {/* Discount Type, Brand, Tier */}
              <s-stack direction="inline" gap="base">
                <s-box padding="base" borderWidth="base" borderRadius="base">
                  <s-stack direction="block" gap="small">
                    <label htmlFor="discount_type">
                      <s-text type="strong">Type de rabais</s-text>
                    </label>
                    <select
                      id="discount_type"
                      name="discount_type"
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    >
                      <option value="">Aucun</option>
                      <option value="fixed_amount">Montant fixe ($)</option>
                      <option value="percentage">Pourcentage (%)</option>
                    </select>
                  </s-stack>
                </s-box>
                <s-box padding="base" borderWidth="base" borderRadius="base">
                  <s-stack direction="block" gap="small">
                    <label htmlFor="brand">
                      <s-text type="strong">Marque</s-text>
                    </label>
                    <select
                      id="brand"
                      name="brand"
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    >
                      <option value="both">Les deux</option>
                      <option value="coloration">Coloration Pro</option>
                      <option value="haircare">Haircare</option>
                    </select>
                  </s-stack>
                </s-box>
                <s-box padding="base" borderWidth="base" borderRadius="base">
                  <s-stack direction="block" gap="small">
                    <label htmlFor="tier_required">
                      <s-text type="strong">Niveau requis</s-text>
                    </label>
                    <select
                      id="tier_required"
                      name="tier_required"
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    >
                      <option value="">Tous les niveaux</option>
                      <option value="CLUB">Club</option>
                      <option value="CLUB_PLUS">Club+</option>
                    </select>
                  </s-stack>
                </s-box>
              </s-stack>

              {/* Stock */}
              <s-stack direction="inline" gap="base">
                <s-box padding="base" borderWidth="base" borderRadius="base">
                  <s-stack direction="block" gap="small">
                    <label htmlFor="stock_limited">
                      <s-text type="strong">Stock limité?</s-text>
                    </label>
                    <select
                      id="stock_limited"
                      name="stock_limited"
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    >
                      <option value="false">Non — illimité</option>
                      <option value="true">Oui — limité</option>
                    </select>
                  </s-stack>
                </s-box>
                <s-box padding="base" borderWidth="base" borderRadius="base">
                  <s-stack direction="block" gap="small">
                    <label htmlFor="stock_count">
                      <s-text type="strong">Quantité en stock</s-text>
                    </label>
                    <input
                      id="stock_count"
                      name="stock_count"
                      type="number"
                      min="0"
                      placeholder="50"
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    />
                  </s-stack>
                </s-box>
              </s-stack>

              {/* Submit */}
              <s-stack direction="inline" gap="base">
                <s-button
                  variant="primary"
                  onClick={() => {
                    const form = document.querySelector(
                      'form[method="post"]',
                    ) as HTMLFormElement;
                    form?.requestSubmit();
                  }}
                  {...(isSubmitting ? { loading: true } : {})}
                >
                  Créer la récompense
                </s-button>
                <s-button
                  variant="tertiary"
                  onClick={() => setShowForm(false)}
                >
                  Annuler
                </s-button>
              </s-stack>

              {fetcher.data?.error && (
                <s-box padding="base" borderWidth="base">
                  <s-text >{fetcher.data.error}</s-text>
                </s-box>
              )}
              {fetcher.data?.success && (
                <s-box padding="base" borderWidth="base">
                  <s-text >
                    {fetcher.data.message || "Succès!"}
                  </s-text>
                </s-box>
              )}
            </s-stack>
          </fetcher.Form>
        </s-section>
      )}

      {/* Rewards List */}
      <s-section heading={`${rewards.length} récompenses`}>
        {rewards.length > 0 ? (
          <s-stack direction="block" gap="base">
            {rewards.map((reward: any) => (
              <s-box
                key={reward.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background={reward.is_active ? "subdued" : undefined}
              >
                <s-stack direction="inline" gap="large">
                  {/* Info */}
                  <s-stack direction="block" gap="small">
                    <s-stack direction="inline" gap="base">
                      <s-link href={`/app/rewards/${reward.id}`}>
                        <s-text type="strong">
                          {reward.name_fr || reward.name}
                        </s-text>
                      </s-link>
                      {!reward.is_active && (
                        <s-badge tone="critical">Inactif</s-badge>
                      )}
                    </s-stack>
                    {(reward.description_fr || reward.description) && (
                      <s-text color="subdued">
                        {reward.description_fr || reward.description}
                      </s-text>
                    )}
                  </s-stack>

                  {/* Meta */}
                  <s-stack direction="inline" gap="base">
                    <s-badge tone="info">
                      {typeLabels[reward.type] || reward.type}
                    </s-badge>
                    <s-text type="strong">{reward.points_cost} pts</s-text>
                    {reward.discount_value && (
                      <s-text color="subdued">
                        {reward.discount_type === "percentage"
                          ? `${reward.discount_value}%`
                          : `${reward.discount_value}$`}
                      </s-text>
                    )}
                    {reward.tier_required && (
                      <s-badge
                        tone={tierColors[reward.tier_required] || "info"}
                      >
                        {tierLabels[reward.tier_required] || reward.tier_required}
                      </s-badge>
                    )}
                    {reward.stock_limited && (
                      <s-text color="subdued">
                        Stock: {reward.stock_count ?? 0}
                      </s-text>
                    )}
                    <s-text color="subdued">
                      {reward._count?.redemptions || 0} échanges
                    </s-text>
                  </s-stack>

                  {/* Actions */}
                  <s-stack direction="inline" gap="small">
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="toggle" />
                      <input type="hidden" name="id" value={reward.id} />
                      <s-button
                        variant="tertiary"
                        onClick={(e: any) => {
                          e.preventDefault();
                          fetcher.submit(
                            { intent: "toggle", id: reward.id },
                            { method: "POST" },
                          );
                        }}
                      >
                        {reward.is_active ? "Désactiver" : "Activer"}
                      </s-button>
                    </fetcher.Form>
                    <s-button
                      variant="secondary"
                      href={`/app/rewards/${reward.id}`}
                    >
                      Modifier
                    </s-button>
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={reward.id} />
                      <s-button
                        variant="tertiary"
                        tone="critical"
                        onClick={(e: any) => {
                          e.preventDefault();
                          if (
                            confirm(
                              "Supprimer cette récompense? Les récompenses avec des échanges seront désactivées.",
                            )
                          ) {
                            fetcher.submit(
                              { intent: "delete", id: reward.id },
                              { method: "POST" },
                            );
                          }
                        }}
                      >
                        Supprimer
                      </s-button>
                    </fetcher.Form>
                  </s-stack>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        ) : (
          <s-box padding="large">
            <s-stack direction="block" gap="base">
              <s-text type="strong">Aucune récompense</s-text>
              <s-paragraph>
                Créez votre première récompense pour que vos membres VIP puissent
                échanger leurs points.
              </s-paragraph>
              <s-button variant="primary" onClick={() => setShowForm(true)}>
                Créer une récompense
              </s-button>
            </s-stack>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
}
