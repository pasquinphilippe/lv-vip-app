import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`[Webhook] ${topic} received for shop: ${shop}`);
  console.log("[Webhook] Subscription contract created:", JSON.stringify(payload, null, 2));

  try {
    // Extract customer info
    const customerId = payload.admin_graphql_api_customer_id;
    const customerEmail = payload.customer?.email;

    if (customerEmail) {
      // Check if member exists, create if not
      let member = await db.vip_members.findUnique({
        where: { email: customerEmail },
      });

      if (!member) {
        // Create new VIP member with CLUB tier (they subscribed!)
        member = await db.vip_members.create({
          data: {
            email: customerEmail,
            first_name: payload.customer?.first_name,
            last_name: payload.customer?.last_name,
            shopify_customer_id_coloration: customerId,
            tier: "CLUB",
            points_multiplier: 2.0,
            academy_access: "full",
          },
        });
        console.log(`[Webhook] Created new VIP member: ${member.id}`);

        // Award welcome bonus
        await db.loyalty_points_ledger.create({
          data: {
            member_id: member.id,
            points: 100, // Welcome bonus
            action: "earn_welcome",
            description: "Bonus de bienvenue - Nouvel abonné",
            reference_type: "subscription",
            reference_id: payload.admin_graphql_api_id,
          },
        });
      } else {
        // Upgrade to CLUB if not already
        if (member.tier === "LITE") {
          await db.vip_members.update({
            where: { id: member.id },
            data: {
              tier: "CLUB",
              points_multiplier: 2.0,
              academy_access: "full",
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

      // Award subscription points
      await db.loyalty_points_ledger.create({
        data: {
          member_id: member.id,
          points: 50,
          action: "earn_subscription",
          description: "Points d'abonnement",
          reference_type: "subscription",
          reference_id: payload.admin_graphql_api_id,
        },
      });
    }
  } catch (error) {
    console.error("[Webhook] Error processing subscription create:", error);
  }

  return new Response(null, { status: 200 });
};
