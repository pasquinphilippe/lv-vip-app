import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`[Webhook] ${topic} received for shop: ${shop}`);
  console.log("[Webhook] Subscription contract updated:", JSON.stringify(payload, null, 2));

  try {
    const shopifySubscriptionId = payload.admin_graphql_api_id;
    const status = payload.status?.toLowerCase() || "active";

    // Find our subscription record
    const subscription = await db.vip_subscriptions.findUnique({
      where: { shopify_subscription_id: shopifySubscriptionId },
    });

    if (subscription) {
      // Map Shopify status to our status
      const statusMap: Record<string, string> = {
        active: "active",
        paused: "paused",
        cancelled: "cancelled",
        failed: "active", // Keep as active but flag it
        expired: "cancelled",
      };

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

      // If cancelled, check if we need to downgrade tier
      if (status === "cancelled") {
        // Check if member has other active subscriptions
        const activeSubscriptions = await db.vip_subscriptions.count({
          where: {
            member_id: subscription.member_id,
            status: "active",
            id: { not: subscription.id },
          },
        });

        if (activeSubscriptions === 0) {
          // Downgrade to LITE
          await db.vip_members.update({
            where: { id: subscription.member_id },
            data: {
              tier: "LITE",
              points_multiplier: 1.5,
              academy_access: "basic",
            },
          });
          console.log(`[Webhook] Downgraded member ${subscription.member_id} to LITE tier`);
        }
      }
    } else {
      console.log(`[Webhook] Subscription not found in our database: ${shopifySubscriptionId}`);
    }
  } catch (error) {
    console.error("[Webhook] Error processing subscription update:", error);
  }

  return new Response(null, { status: 200 });
};
