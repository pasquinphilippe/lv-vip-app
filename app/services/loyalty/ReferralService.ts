import db from "~/db.server";
import type { vip_members } from "@prisma/client";
import type { ShopSettings } from "./SettingsService";
import { nanoid } from "nanoid";

const REFERRAL_CODE_PREFIX = "REF-LV";

export interface ReferralRewardResult {
  processed: boolean;
  referrerPointsAwarded: number;
  refereePointsAwarded: number;
  referralEventId?: string;
}

export interface OrderDiscountCode {
  code: string;
  amount?: string;
  type?: string;
}

/**
 * Generate a unique referral code for a member
 */
export async function generateReferralCode(memberId: string): Promise<string> {
  const code = `${REFERRAL_CODE_PREFIX}${nanoid(8).toUpperCase()}`;

  await db.vip_members.update({
    where: { id: memberId },
    data: { referral_code: code },
  });

  return code;
}

/**
 * Extract referral code from order discount codes
 */
export function extractReferralCode(
  discountCodes: OrderDiscountCode[]
): string | null {
  if (!discountCodes || !Array.isArray(discountCodes)) {
    return null;
  }

  const referralCode = discountCodes.find((dc) =>
    dc.code?.startsWith(REFERRAL_CODE_PREFIX)
  );

  return referralCode?.code || null;
}

/**
 * Process referral reward when a qualifying order is placed
 */
export async function processReferralReward(
  referee: vip_members,
  orderId: string,
  orderTotal: number,
  settings: ShopSettings
): Promise<ReferralRewardResult> {
  const result: ReferralRewardResult = {
    processed: false,
    referrerPointsAwarded: 0,
    refereePointsAwarded: 0,
  };

  // Check if referral program is enabled
  if (!settings.referral_enabled) {
    return result;
  }

  // Check if member was referred and hasn't been rewarded yet
  if (!referee.referred_by) {
    return result;
  }

  // Find pending referral event
  const pendingEvent = await db.referral_events.findFirst({
    where: {
      referee_id: referee.id,
      status: "pending",
    },
  });

  if (!pendingEvent) {
    return result;
  }

  // Check minimum purchase requirement
  const minPurchase = settings.referral_min_purchase
    ? Number(settings.referral_min_purchase)
    : 0;

  if (orderTotal < minPurchase) {
    console.log(`[ReferralService] Order total ${orderTotal} below minimum ${minPurchase}`);
    return result;
  }

  // Award points to both parties
  const referrerPoints = settings.referrer_reward_points;
  const refereePoints = settings.referee_reward_points;

  // Update referral event
  await db.referral_events.update({
    where: { id: pendingEvent.id },
    data: {
      qualifying_order_id: orderId,
      referrer_points_awarded: referrerPoints,
      referee_points_awarded: refereePoints,
      status: "completed",
      completed_at: new Date(),
    },
  });

  // Award points to referrer
  if (referrerPoints > 0) {
    await db.loyalty_points_ledger.create({
      data: {
        member_id: pendingEvent.referrer_id,
        points: referrerPoints,
        action: "earn_referral",
        description: "Bonus de parrainage - Filleul qualifié",
        reference_type: "referral",
        reference_id: pendingEvent.id,
      },
    });

    await db.vip_members.update({
      where: { id: pendingEvent.referrer_id },
      data: {
        points_balance: { increment: referrerPoints },
        lifetime_points: { increment: referrerPoints },
        referral_count: { increment: 1 },
      },
    });
  }

  // Award points to referee
  if (refereePoints > 0) {
    await db.loyalty_points_ledger.create({
      data: {
        member_id: referee.id,
        points: refereePoints,
        action: "earn_referral",
        description: "Bonus de parrainage - Premier achat",
        reference_type: "referral",
        reference_id: pendingEvent.id,
      },
    });

    await db.vip_members.update({
      where: { id: referee.id },
      data: {
        points_balance: { increment: refereePoints },
        lifetime_points: { increment: refereePoints },
      },
    });
  }

  result.processed = true;
  result.referrerPointsAwarded = referrerPoints;
  result.refereePointsAwarded = refereePoints;
  result.referralEventId = pendingEvent.id;

  console.log(
    `[ReferralService] Completed referral ${pendingEvent.id}: ` +
    `referrer +${referrerPoints}pts, referee +${refereePoints}pts`
  );

  return result;
}

/**
 * Create a pending referral event when a new member uses a referral code
 */
export async function createReferralEvent(
  referralCode: string,
  refereeId: string
): Promise<boolean> {
  // Find the referrer by their referral code
  const referrer = await db.vip_members.findUnique({
    where: { referral_code: referralCode },
  });

  if (!referrer) {
    console.log(`[ReferralService] Invalid referral code: ${referralCode}`);
    return false;
  }

  // Prevent self-referral
  if (referrer.id === refereeId) {
    console.log(`[ReferralService] Self-referral attempt blocked`);
    return false;
  }

  // Check if referral already exists
  const existingEvent = await db.referral_events.findFirst({
    where: {
      referrer_id: referrer.id,
      referee_id: refereeId,
    },
  });

  if (existingEvent) {
    console.log(`[ReferralService] Referral already exists for this pair`);
    return false;
  }

  // Create pending referral event
  await db.referral_events.create({
    data: {
      referrer_id: referrer.id,
      referee_id: refereeId,
      status: "pending",
    },
  });

  // Update referee's referred_by field
  await db.vip_members.update({
    where: { id: refereeId },
    data: { referred_by: referrer.id },
  });

  console.log(`[ReferralService] Created referral event: ${referrer.id} -> ${refereeId}`);

  return true;
}

/**
 * Check if a code is a valid referral code format
 */
export function isReferralCode(code: string): boolean {
  return code?.startsWith(REFERRAL_CODE_PREFIX) || false;
}
