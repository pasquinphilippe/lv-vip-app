import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`[Webhook] ${topic} received for shop: ${shop}`);

  try {
    const customerEmail = payload.customer?.email;
    const totalPrice = parseFloat(payload.total_price || 0);

    if (customerEmail && totalPrice > 0) {
      // Find VIP member
      const member = await db.vip_members.findUnique({
        where: { email: customerEmail },
      });

      if (member) {
        // Calculate points based on tier multiplier
        const basePoints = Math.floor(totalPrice); // 1 point per dollar
        const earnedPoints = Math.floor(basePoints * Number(member.points_multiplier));

        // Award points
        await db.loyalty_points_ledger.create({
          data: {
            member_id: member.id,
            points: earnedPoints,
            action: "earn_purchase",
            description: `Achat - Commande ${payload.name || payload.order_number}`,
            reference_type: "order",
            reference_id: payload.admin_graphql_api_id,
          },
        });

        // Update member points balance
        await db.vip_members.update({
          where: { id: member.id },
          data: {
            points_balance: { increment: earnedPoints },
            lifetime_points: { increment: earnedPoints },
          },
        });

        console.log(`[Webhook] Awarded ${earnedPoints} points to member ${member.id}`);

        // Check for tier upgrade based on lifetime points
        const updatedMember = await db.vip_members.findUnique({
          where: { id: member.id },
        });

        if (updatedMember) {
          let newTier = updatedMember.tier;
          let newMultiplier = Number(updatedMember.points_multiplier);
          let newAccess = updatedMember.academy_access;

          // Tier thresholds
          if (updatedMember.lifetime_points >= 5000 && updatedMember.tier !== "CLUB_PLUS") {
            newTier = "CLUB_PLUS";
            newMultiplier = 3.5;
            newAccess = "premium";
          } else if (updatedMember.lifetime_points >= 1000 && updatedMember.tier === "LITE") {
            newTier = "CLUB";
            newMultiplier = 2.0;
            newAccess = "full";
          }

          if (newTier !== updatedMember.tier) {
            await db.vip_members.update({
              where: { id: member.id },
              data: {
                tier: newTier,
                points_multiplier: newMultiplier,
                academy_access: newAccess,
                tier_started_at: new Date(),
              },
            });
            console.log(`[Webhook] Upgraded member ${member.id} to ${newTier}`);

            // Award milestone points
            await db.loyalty_points_ledger.create({
              data: {
                member_id: member.id,
                points: 100,
                action: "earn_milestone",
                description: `Passage au niveau ${newTier}`,
                reference_type: "tier_upgrade",
                reference_id: newTier,
              },
            });
          }
        }
      } else {
        // Create new LITE member for non-subscribers
        const newMember = await db.vip_members.create({
          data: {
            email: customerEmail,
            first_name: payload.customer?.first_name,
            last_name: payload.customer?.last_name,
            tier: "LITE",
            points_multiplier: 1.5,
          },
        });

        // Award first purchase points
        const earnedPoints = Math.floor(totalPrice * 1.5);
        await db.loyalty_points_ledger.create({
          data: {
            member_id: newMember.id,
            points: earnedPoints,
            action: "earn_purchase",
            description: `Premier achat - Commande ${payload.name || payload.order_number}`,
            reference_type: "order",
            reference_id: payload.admin_graphql_api_id,
          },
        });

        await db.vip_members.update({
          where: { id: newMember.id },
          data: {
            points_balance: earnedPoints,
            lifetime_points: earnedPoints,
          },
        });

        console.log(`[Webhook] Created new LITE member ${newMember.id} with ${earnedPoints} points`);
      }
    }
  } catch (error) {
    console.error("[Webhook] Error processing order create:", error);
  }

  return new Response(null, { status: 200 });
};
