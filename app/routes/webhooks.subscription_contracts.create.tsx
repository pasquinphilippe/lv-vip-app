import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  getShopSettings,
  getWelcomeBonus,
  calculateSubscriptionPurchasePoints,
  getTierMultiplier,
  getAcademyAccess,
} from "~/services/loyalty";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`[Webhook] ${topic} received for shop: ${shop}`);
  console.log("[Webhook] Subscription contract created:", JSON.stringify(payload, null, 2));

  try {
    // Extract customer info
    const customerId = payload.admin_graphql_api_customer_id;
    const customerEmail = payload.customer?.email;

    if (!customerEmail) {
      console.log("[Webhook] No customer email, skipping");
      return new Response(null, { status: 200 });
    }

    // Get shop settings (cached)
    const settings = await getShopSettings(shop);

    if (!settings.loyalty_enabled) {
      console.log(`[Webhook] Loyalty disabled for shop: ${shop}`);
      return new Response(null, { status: 200 });
    }

    // Check if member exists, create if not (auto-enroll)
    let member = await db.vip_members.findUnique({
      where: { email: customerEmail },
    });

    const clubMultiplier = getTierMultiplier(settings, "CLUB");
    const clubAcademy = getAcademyAccess(settings, "CLUB");

    if (!member) {
      // Create new VIP member with CLUB tier (they subscribed!)
      member = await db.vip_members.create({
        data: {
          email: customerEmail,
          first_name: payload.customer?.first_name,
          last_name: payload.customer?.last_name,
          shopify_customer_id_coloration: customerId,
          tier: "CLUB",
          points_multiplier: clubMultiplier,
          academy_access: clubAcademy,
        },
      });
      console.log(`[Webhook] Created new VIP member (auto-enrolled): ${member.id}`);

      // Award welcome bonus
      const welcomeBonus = getWelcomeBonus(settings);
      if (welcomeBonus > 0) {
        await db.loyalty_points_ledger.create({
          data: {
            member_id: member.id,
            points: welcomeBonus,
            action: "earn_welcome",
            description: "Bonus de bienvenue - Nouvel abonné",
            reference_type: "subscription",
            reference_id: payload.admin_graphql_api_id,
          },
        });

        await db.vip_members.update({
          where: { id: member.id },
          data: {
            points_balance: { increment: welcomeBonus },
            lifetime_points: { increment: welcomeBonus },
          },
        });

        console.log(`[Webhook] Awarded ${welcomeBonus} welcome bonus points`);
      }
    } else {
      // Upgrade to CLUB if currently LITE
      if (member.tier === "LITE") {
        await db.vip_members.update({
          where: { id: member.id },
          data: {
            tier: "CLUB",
            tier_started_at: new Date(),
            points_multiplier: clubMultiplier,
            academy_access: clubAcademy,
          },
        });
        console.log(`[Webhook] Upgraded member ${member.id} to CLUB tier`);
      }
    }

    // Create subscription record in our database
    await db.vip_subscriptions.create({
      data: {
        member_id: member.id,
        shopify_subscription_id: payload.admin_graphql_api_id,
        brand: "coloration", // Default, can be updated
        status: "active",
        cadence: "4_weeks", // Default
        next_billing_date: payload.next_billing_date
          ? new Date(payload.next_billing_date)
          : null,
      },
    });
    console.log(`[Webhook] Created subscription record for member ${member.id}`);

    // Award points based on order total × 200 (subscription rate)
    const orderTotal = parseFloat(payload.origin_order?.total_price || payload.current_order?.total_price || "0");
    
    if (orderTotal > 0) {
      const earnedPoints = calculateSubscriptionPurchasePoints(orderTotal, settings);

      if (earnedPoints > 0) {
        await db.loyalty_points_ledger.create({
          data: {
            member_id: member.id,
            points: earnedPoints,
            action: "earn_subscription_purchase",
            description: `Achat abonnement - ${orderTotal.toFixed(2)}$ × ${settings.subscription_points_per_dollar} pts`,
            reference_type: "subscription",
            reference_id: payload.admin_graphql_api_id,
          },
        });

        await db.vip_members.update({
          where: { id: member.id },
          data: {
            points_balance: { increment: earnedPoints },
            lifetime_points: { increment: earnedPoints },
          },
        });

        console.log(`[Webhook] Awarded ${earnedPoints} subscription purchase points (${orderTotal}$ × ${settings.subscription_points_per_dollar})`);
      }
    }
  } catch (error) {
    console.error("[Webhook] Error processing subscription create:", error);
  }

  return new Response(null, { status: 200 });
};
