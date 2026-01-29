import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  getShopSettings,
  calculatePurchasePoints,
  calculateNewMemberPurchasePoints,
  checkAndUpgradeTier,
  processReferralReward,
  checkAndAwardBirthdayPoints,
  extractReferralCode,
  createReferralEvent,
  getTierMultiplier,
  getAcademyAccess,
} from "~/services/loyalty";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`[Webhook] ${topic} received for shop: ${shop}`);

  try {
    const customerEmail = payload.customer?.email;
    const totalPrice = parseFloat(payload.total_price || 0);

    if (!customerEmail || totalPrice <= 0) {
      return new Response(null, { status: 200 });
    }

    // Get shop settings (cached)
    const settings = await getShopSettings(shop);

    if (!settings.loyalty_enabled) {
      console.log(`[Webhook] Loyalty disabled for shop: ${shop}`);
      return new Response(null, { status: 200 });
    }

    // Find VIP member
    let member = await db.vip_members.findUnique({
      where: { email: customerEmail },
    });

    if (member) {
      // Calculate points using dynamic settings
      const earnedPoints = calculatePurchasePoints({
        totalPrice,
        member,
        settings,
      });

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

      // Refetch member with updated points for tier check
      const updatedMember = await db.vip_members.findUnique({
        where: { id: member.id },
      });

      if (updatedMember) {
        // Check for tier upgrade
        const tierResult = await checkAndUpgradeTier(updatedMember, settings);
        if (tierResult.upgraded) {
          console.log(
            `[Webhook] Upgraded member ${member.id} from ${tierResult.previousTier} to ${tierResult.newTier}`
          );
        }

        // Process referral reward if applicable
        const referralResult = await processReferralReward(
          updatedMember,
          payload.admin_graphql_api_id,
          totalPrice,
          settings
        );
        if (referralResult.processed) {
          console.log(
            `[Webhook] Processed referral: referrer +${referralResult.referrerPointsAwarded}pts, referee +${referralResult.refereePointsAwarded}pts`
          );
        }

        // Check birthday reward eligibility
        const birthdayResult = await checkAndAwardBirthdayPoints(updatedMember, settings);
        if (birthdayResult.awarded) {
          console.log(`[Webhook] Awarded ${birthdayResult.points} birthday points`);
        }
      }
    } else {
      // New customer - create LITE member
      const liteMultiplier = getTierMultiplier(settings, "LITE");
      const liteAcademy = getAcademyAccess(settings, "LITE");

      const newMember = await db.vip_members.create({
        data: {
          email: customerEmail,
          first_name: payload.customer?.first_name,
          last_name: payload.customer?.last_name,
          tier: "LITE",
          points_multiplier: liteMultiplier,
          academy_access: liteAcademy,
        },
      });

      // Check for referral code in discount codes
      const discountCodes = payload.discount_codes || [];
      const referralCode = extractReferralCode(discountCodes);

      if (referralCode) {
        await createReferralEvent(referralCode, newMember.id);
        console.log(`[Webhook] Created referral event for code: ${referralCode}`);
      }

      // Award first purchase points
      const earnedPoints = calculateNewMemberPurchasePoints(totalPrice, settings);

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

      // Process referral if one was created
      if (referralCode) {
        const updatedNewMember = await db.vip_members.findUnique({
          where: { id: newMember.id },
        });
        if (updatedNewMember) {
          await processReferralReward(
            updatedNewMember,
            payload.admin_graphql_api_id,
            totalPrice,
            settings
          );
        }
      }
    }
  } catch (error) {
    console.error("[Webhook] Error processing order create:", error);
  }

  return new Response(null, { status: 200 });
};
