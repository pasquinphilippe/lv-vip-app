import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  getShopSettings,
  downgradeTier,
  calculateSubscriptionPoints,
} from "~/services/loyalty";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`[Webhook] ${topic} received for shop: ${shop}`);
  console.log("[Webhook] Subscription contract updated:", JSON.stringify(payload, null, 2));

  try {
    const shopifySubscriptionId = payload.admin_graphql_api_id;
    const status = payload.status?.toLowerCase() || "active";

    // Get shop settings (cached)
    const settings = await getShopSettings(shop);

    // Find our subscription record
    const subscription = await db.vip_subscriptions.findUnique({
      where: { shopify_subscription_id: shopifySubscriptionId },
    });

    if (!subscription) {
      console.log(`[Webhook] Subscription not found in our database: ${shopifySubscriptionId}`);
      return new Response(null, { status: 200 });
    }

    // Map Shopify status to our status
    const statusMap: Record<string, string> = {
      active: "active",
      paused: "paused",
      cancelled: "cancelled",
      failed: "active", // Keep as active but flag it
      expired: "cancelled",
    };

    const previousStatus = subscription.status;
    const newStatus = statusMap[status] || "active";

    // Update subscription record
    await db.vip_subscriptions.update({
      where: { id: subscription.id },
      data: {
        status: newStatus,
        next_billing_date: payload.next_billing_date
          ? new Date(payload.next_billing_date)
          : subscription.next_billing_date,
        pause_started_at: status === "paused" ? new Date() : null,
        cancelled_at: status === "cancelled" ? new Date() : null,
      },
    });

    console.log(`[Webhook] Updated subscription ${subscription.id} to status: ${newStatus}`);

    // Handle status-specific logic
    if (status === "cancelled") {
      // Downgrade tier if no other active subscriptions
      await downgradeTier(subscription.member_id, settings);
    }

    // Handle reactivation (paused → active)
    if (previousStatus === "paused" && newStatus === "active") {
      const reactivationBonus = settings.reactivation_bonus;

      if (reactivationBonus > 0 && settings.loyalty_enabled) {
        await db.loyalty_points_ledger.create({
          data: {
            member_id: subscription.member_id,
            points: reactivationBonus,
            action: "earn_reactivation",
            description: "Bonus de réactivation d'abonnement",
            reference_type: "subscription",
            reference_id: shopifySubscriptionId,
          },
        });

        await db.vip_members.update({
          where: { id: subscription.member_id },
          data: {
            points_balance: { increment: reactivationBonus },
            lifetime_points: { increment: reactivationBonus },
          },
        });

        console.log(`[Webhook] Awarded ${reactivationBonus} reactivation bonus points`);
      }
    }

    // Handle renewal (subscription billing cycle completed)
    if (previousStatus === "active" && newStatus === "active" && payload.last_payment_status === "success") {
      const renewalPoints = calculateSubscriptionPoints({
        isNewSubscription: false,
        settings,
      });

      if (renewalPoints > 0 && settings.loyalty_enabled) {
        // Update total orders count
        await db.vip_subscriptions.update({
          where: { id: subscription.id },
          data: {
            total_orders: { increment: 1 },
            last_billed_at: new Date(),
          },
        });

        await db.loyalty_points_ledger.create({
          data: {
            member_id: subscription.member_id,
            points: renewalPoints,
            action: "earn_subscription_renewal",
            description: "Points de renouvellement d'abonnement",
            reference_type: "subscription",
            reference_id: shopifySubscriptionId,
          },
        });

        await db.vip_members.update({
          where: { id: subscription.member_id },
          data: {
            points_balance: { increment: renewalPoints },
            lifetime_points: { increment: renewalPoints },
          },
        });

        console.log(`[Webhook] Awarded ${renewalPoints} renewal points`);
      }
    }
  } catch (error) {
    console.error("[Webhook] Error processing subscription update:", error);
  }

  return new Response(null, { status: 200 });
};
