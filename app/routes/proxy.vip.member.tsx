import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { verifyAppProxySignature, getProxyCustomerId } from "~/services/proxy/verifyProxy";

/**
 * App Proxy Route: GET /apps/vip/member
 *
 * Returns member data: points, tier, history
 * Shopify App Proxy forwards requests here.
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

  const customerId = getProxyCustomerId(url);
  if (!customerId) {
    return Response.json(
      { error: "Client non connecté" },
      { status: 401 },
    );
  }

  // Find member by Shopify customer ID (try both stores)
  const member = await prisma.vip_members.findFirst({
    where: {
      OR: [
        { shopify_customer_id_coloration: customerId },
        { shopify_customer_id_haircare: customerId },
      ],
    },
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      tier: true,
      points_balance: true,
      lifetime_points: true,
      referral_code: true,
      birthday_month: true,
      created_at: true,
    },
  });

  if (!member) {
    return Response.json(
      { member: null, message: "Pas encore membre VIP" },
      { status: 200 },
    );
  }

  // Get recent points history (last 20)
  const history = await prisma.loyalty_points_ledger.findMany({
    where: { member_id: member.id },
    orderBy: { created_at: "desc" },
    take: 20,
    select: {
      id: true,
      points: true,
      action: true,
      description: true,
      created_at: true,
    },
  });

  // Get active redemptions
  const redemptions = await prisma.loyalty_redemptions.findMany({
    where: {
      member_id: member.id,
      status: { in: ["pending", "applied"] },
    },
    orderBy: { created_at: "desc" },
    take: 10,
    include: {
      reward: {
        select: { name: true, name_fr: true, type: true },
      },
    },
  });

  // Get subscription status
  const subscription = await prisma.vip_subscriptions.findFirst({
    where: {
      member_id: member.id,
      status: "active",
    },
    select: {
      status: true,
      cadence: true,
      next_billing_date: true,
    },
  });

  const tierLabels: Record<string, string> = {
    LITE: "VIP Lite",
    CLUB: "VIP Club",
    CLUB_PLUS: "VIP Club+",
  };

  return Response.json({
    member: {
      ...member,
      tier_label: tierLabels[member.tier] || member.tier,
      created_at: member.created_at.toISOString(),
    },
    history: history.map((h) => ({
      ...h,
      created_at: h.created_at.toISOString(),
    })),
    redemptions: redemptions.map((r) => ({
      id: r.id,
      points_spent: r.points_spent,
      status: r.status,
      discount_code: r.shopify_discount_code,
      reward_name: r.reward.name_fr || r.reward.name,
      reward_type: r.reward.type,
      created_at: r.created_at.toISOString(),
      expires_at: r.expires_at?.toISOString() || null,
    })),
    subscription: subscription
      ? {
          ...subscription,
          next_billing_date: subscription.next_billing_date?.toISOString() || null,
        }
      : null,
  });
};
