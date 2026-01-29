import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { verifyAppProxySignature, getProxyCustomerId } from "~/services/proxy/verifyProxy";

/**
 * App Proxy Route: GET /apps/vip/rewards
 *
 * Returns available rewards for the member's tier.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // Verify Shopify signature
  if (!verifyAppProxySignature(url)) {
    return Response.json(
      { error: "Signature invalide" },
      { status: 401 },
    );
  }

  // Determine which brand this request is from
  const shop = url.searchParams.get("shop") || "";
  const brand = shop.includes("coloration") ? "coloration" : "haircare";

  // Get customer tier if logged in
  let memberTier = "LITE";
  const customerId = getProxyCustomerId(url);
  if (customerId) {
    const member = await prisma.vip_members.findFirst({
      where: {
        OR: [
          { shopify_customer_id_coloration: customerId },
          { shopify_customer_id_haircare: customerId },
        ],
      },
      select: { tier: true, points_balance: true },
    });
    if (member) {
      memberTier = member.tier;
    }
  }

  // Get tier order for filtering
  const tierOrder = ["LITE", "CLUB", "CLUB_PLUS"];
  const memberTierIndex = tierOrder.indexOf(memberTier);

  // Get rewards available for this tier and brand
  const rewards = await prisma.loyalty_rewards.findMany({
    where: {
      is_active: true,
      brand: { in: [brand, "both"] },
      OR: [
        { tier_required: null },
        {
          tier_required: {
            in: tierOrder.slice(0, memberTierIndex + 1),
          },
        },
      ],
    },
    orderBy: [{ sort_order: "asc" }, { points_cost: "asc" }],
    select: {
      id: true,
      name: true,
      name_fr: true,
      description: true,
      description_fr: true,
      type: true,
      points_cost: true,
      discount_value: true,
      discount_type: true,
      tier_required: true,
      stock_limited: true,
      stock_count: true,
    },
  });

  const tierLabels: Record<string, string> = {
    LITE: "Lite",
    CLUB: "Club",
    CLUB_PLUS: "Club+",
  };

  const typeLabels: Record<string, string> = {
    discount: "Rabais",
    shipping: "Livraison gratuite",
    product: "Produit gratuit",
    add_on: "Add-on gratuit",
    experience: "Expérience",
    exclusive: "Exclusif",
  };

  return Response.json({
    rewards: rewards.map((r) => ({
      id: r.id,
      name: r.name_fr || r.name,
      name_en: r.name,
      description: r.description_fr || r.description,
      type: r.type,
      type_label: typeLabels[r.type] || r.type,
      points_cost: r.points_cost,
      discount_value: r.discount_value ? Number(r.discount_value) : null,
      discount_type: r.discount_type,
      tier_required: r.tier_required,
      tier_label: r.tier_required ? tierLabels[r.tier_required] : null,
      in_stock: !r.stock_limited || (r.stock_count !== null && r.stock_count > 0),
      stock_count: r.stock_limited ? r.stock_count : null,
    })),
    member_tier: memberTier,
    member_tier_label: tierLabels[memberTier],
  });
};
