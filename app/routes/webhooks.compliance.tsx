import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`[Webhook] Compliance ${topic} received for shop: ${shop}`);

  try {
    switch (topic) {
      case "CUSTOMERS_DATA_REQUEST":
        // Handle customer data request (GDPR)
        // Return all data we have about this customer
        const customerEmail = payload.customer?.email;
        if (customerEmail) {
          const member = await db.vip_members.findUnique({
            where: { email: customerEmail },
            include: {
              subscriptions: true,
              points_ledger: true,
              redemptions: true,
            },
          });
          
          console.log(`[Webhook] Customer data request for ${customerEmail}:`, member ? "Found" : "Not found");
          // In production, you would email this data to the customer or store admin
        }
        break;

      case "CUSTOMERS_REDACT":
        // Handle customer data deletion (GDPR)
        const redactEmail = payload.customer?.email;
        if (redactEmail) {
          const memberToDelete = await db.vip_members.findUnique({
            where: { email: redactEmail },
          });

          if (memberToDelete) {
            // Delete in order: redemptions, points, subscriptions, then member
            await db.loyalty_redemptions.deleteMany({
              where: { member_id: memberToDelete.id },
            });
            await db.loyalty_points_ledger.deleteMany({
              where: { member_id: memberToDelete.id },
            });
            await db.vip_subscriptions.deleteMany({
              where: { member_id: memberToDelete.id },
            });
            await db.vip_members.delete({
              where: { id: memberToDelete.id },
            });
            
            console.log(`[Webhook] Deleted all data for customer ${redactEmail}`);
          }
        }
        break;

      case "SHOP_REDACT":
        // Handle shop data deletion
        // This is called 48 hours after app uninstall
        console.log(`[Webhook] Shop redact for ${shop} - cleaning up shop data`);
        
        // Delete shop settings
        await db.shop_settings.deleteMany({
          where: { shop_domain: shop },
        });
        
        // Note: In production, you might want to anonymize rather than delete
        // member data, or keep it for a grace period
        break;

      default:
        console.log(`[Webhook] Unknown compliance topic: ${topic}`);
    }
  } catch (error) {
    console.error("[Webhook] Error processing compliance webhook:", error);
  }

  return new Response(null, { status: 200 });
};
