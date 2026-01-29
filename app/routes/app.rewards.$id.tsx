import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const reward = await prisma.loyalty_rewards.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { redemptions: true } },
      redemptions: {
        orderBy: { created_at: "desc" },
        take: 10,
        include: {
          member: {
            select: {
              email: true,
              first_name: true,
              last_name: true,
              tier: true,
            },
          },
        },
      },
    },
  });

  if (!reward) {
    throw new Response("Récompense introuvable", { status: 404 });
  }

  return { reward };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "update") {
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
    const is_active = formData.get("is_active") === "true";
    const stock_limited = formData.get("stock_limited") === "true";
    const stock_count = formData.get("stock_count")
      ? parseInt(formData.get("stock_count") as string, 10)
      : null;
    const sort_order = formData.get("sort_order")
      ? parseInt(formData.get("sort_order") as string, 10)
      : 0;

    if (!name || !type || !points_cost) {
      return { error: "Nom, type et coût en points requis." };
    }

    await prisma.loyalty_rewards.update({
      where: { id: params.id },
      data: {
        name,
        name_fr: name_fr || null,
        description,
        description_fr,
        type,
        points_cost,
        discount_value,
        discount_type: discount_type || null,
        brand,
        tier_required: tier_required || null,
        is_active,
        stock_limited,
        stock_count: stock_limited ? stock_count : null,
        sort_order,
      },
    });

    return { success: true, message: "Récompense mise à jour." };
  }

  return { error: "Action inconnue." };
};

export default function RewardEditPage() {
  const { reward } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();

  const isSubmitting =
    fetcher.state === "submitting" || fetcher.state === "loading";

  const tierLabels: Record<string, string> = {
    LITE: "Lite",
    CLUB: "Club",
    CLUB_PLUS: "Club+",
  };

  const statusLabels: Record<string, string> = {
    pending: "En attente",
    applied: "Appliqué",
    expired: "Expiré",
    refunded: "Remboursé",
  };

  return (
    <s-page
      heading={`Modifier: ${reward.name_fr || reward.name}`}
    >
      <s-button slot="primary-action" href="/app/rewards" variant="tertiary">
        ← Retour
      </s-button>
      <s-section heading="Informations">
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="update" />
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
                    defaultValue={reward.name}
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
                    defaultValue={reward.name_fr || ""}
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
                    defaultValue={reward.description || ""}
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
                    defaultValue={reward.description_fr || ""}
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
                    defaultValue={reward.type}
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
                    defaultValue={reward.points_cost}
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
                    <s-text type="strong">Valeur du rabais</s-text>
                  </label>
                  <input
                    id="discount_value"
                    name="discount_value"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={reward.discount_value?.toString() || ""}
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

            {/* Discount Type, Brand, Tier, Active */}
            <s-stack direction="inline" gap="base">
              <s-box padding="base" borderWidth="base" borderRadius="base">
                <s-stack direction="block" gap="small">
                  <label htmlFor="discount_type">
                    <s-text type="strong">Type de rabais</s-text>
                  </label>
                  <select
                    id="discount_type"
                    name="discount_type"
                    defaultValue={reward.discount_type || ""}
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
                    defaultValue={reward.brand}
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
                    defaultValue={reward.tier_required || ""}
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

            {/* Status, Stock, Sort */}
            <s-stack direction="inline" gap="base">
              <s-box padding="base" borderWidth="base" borderRadius="base">
                <s-stack direction="block" gap="small">
                  <label htmlFor="is_active">
                    <s-text type="strong">Statut</s-text>
                  </label>
                  <select
                    id="is_active"
                    name="is_active"
                    defaultValue={reward.is_active ? "true" : "false"}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                    }}
                  >
                    <option value="true">Actif</option>
                    <option value="false">Inactif</option>
                  </select>
                </s-stack>
              </s-box>
              <s-box padding="base" borderWidth="base" borderRadius="base">
                <s-stack direction="block" gap="small">
                  <label htmlFor="stock_limited">
                    <s-text type="strong">Stock limité?</s-text>
                  </label>
                  <select
                    id="stock_limited"
                    name="stock_limited"
                    defaultValue={reward.stock_limited ? "true" : "false"}
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
                    defaultValue={reward.stock_count?.toString() || ""}
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
                  <label htmlFor="sort_order">
                    <s-text type="strong">Ordre d'affichage</s-text>
                  </label>
                  <input
                    id="sort_order"
                    name="sort_order"
                    type="number"
                    min="0"
                    defaultValue={reward.sort_order}
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
                Enregistrer
              </s-button>
              <s-button
                variant="tertiary"
                onClick={() => navigate("/app/rewards")}
              >
                Retour
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

      {/* Stats - Aside */}
      <s-section slot="aside" heading="Statistiques">
        <s-stack direction="block" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Total échanges</s-text>
              <s-text type="strong">{reward._count?.redemptions || 0}</s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Coût en points</s-text>
              <s-text type="strong">{reward.points_cost} pts</s-text>
            </s-stack>
          </s-box>
          {reward.stock_limited && (
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text color="subdued">Stock restant</s-text>
                <s-text type="strong">{reward.stock_count ?? 0}</s-text>
              </s-stack>
            </s-box>
          )}
        </s-stack>
      </s-section>

      {/* Recent Redemptions */}
      <s-section heading="Échanges récents">
        {reward.redemptions && reward.redemptions.length > 0 ? (
          <s-stack direction="block" gap="small">
            {reward.redemptions.map((r: any) => (
              <s-box
                key={r.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="subdued"
              >
                <s-stack direction="inline" gap="large">
                  <s-stack direction="block" gap="small">
                    <s-text type="strong">
                      {r.member.first_name} {r.member.last_name}
                    </s-text>
                    <s-text color="subdued">{r.member.email}</s-text>
                  </s-stack>
                  <s-stack direction="inline" gap="base">
                    <s-badge
                      tone={
                        r.status === "applied"
                          ? "success"
                          : r.status === "pending"
                            ? "warning"
                            : "critical"
                      }
                    >
                      {statusLabels[r.status] || r.status}
                    </s-badge>
                    <s-text>{r.points_spent} pts</s-text>
                    {r.shopify_discount_code && (
                      <s-text color="subdued">
                        Code: {r.shopify_discount_code}
                      </s-text>
                    )}
                    <s-text color="subdued">
                      {new Date(r.created_at).toLocaleDateString("fr-CA")}
                    </s-text>
                  </s-stack>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        ) : (
          <s-box padding="large">
            <s-paragraph>Aucun échange pour cette récompense.</s-paragraph>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
}
