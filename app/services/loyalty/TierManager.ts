import db from "~/db.server";
import type { vip_members } from "@prisma/client";
import type { ShopSettings } from "./SettingsService";
import { getTierMultiplier, getAcademyAccess } from "./SettingsService";
import { getMilestoneBonus } from "./PointsCalculator";

export type VipTier = "LITE" | "CLUB" | "CLUB_PLUS";

export interface TierUpgradeResult {
  upgraded: boolean;
  previousTier: VipTier;
  newTier: VipTier;
  milestonePointsAwarded: number;
}

/**
 * Determine the appropriate tier based on lifetime points
 */
export function determineTier(
  lifetimePoints: number,
  settings: ShopSettings
): VipTier {
  const thresholds = settings.tierThresholds;

  if (lifetimePoints >= thresholds.CLUB_PLUS) {
    return "CLUB_PLUS";
  } else if (lifetimePoints >= thresholds.CLUB) {
    return "CLUB";
  }

  return "LITE";
}

/**
 * Check and upgrade member tier if needed
 */
export async function checkAndUpgradeTier(
  member: vip_members,
  settings: ShopSettings
): Promise<TierUpgradeResult> {
  const currentTier = member.tier as VipTier;
  const newTier = determineTier(member.lifetime_points, settings);

  const result: TierUpgradeResult = {
    upgraded: false,
    previousTier: currentTier,
    newTier: currentTier,
    milestonePointsAwarded: 0,
  };

  // Only upgrade (never downgrade based on points)
  if (shouldUpgrade(currentTier, newTier)) {
    result.upgraded = true;
    result.newTier = newTier;
    result.milestonePointsAwarded = getMilestoneBonus(settings);

    // Update member tier
    await db.vip_members.update({
      where: { id: member.id },
      data: {
        tier: newTier,
        points_multiplier: getTierMultiplier(settings, newTier),
        academy_access: getAcademyAccess(settings, newTier),
        tier_started_at: new Date(),
      },
    });

    // Award milestone bonus
    if (result.milestonePointsAwarded > 0) {
      await db.loyalty_points_ledger.create({
        data: {
          member_id: member.id,
          points: result.milestonePointsAwarded,
          action: "earn_milestone",
          description: `Passage au niveau ${newTier}`,
          reference_type: "tier_upgrade",
          reference_id: newTier,
        },
      });

      await db.vip_members.update({
        where: { id: member.id },
        data: {
          points_balance: { increment: result.milestonePointsAwarded },
          lifetime_points: { increment: result.milestonePointsAwarded },
        },
      });
    }

    console.log(`[TierManager] Upgraded member ${member.id} from ${currentTier} to ${newTier}`);
  }

  return result;
}

/**
 * Downgrade member tier (called when subscription is cancelled)
 */
export async function downgradeTier(
  memberId: string,
  settings: ShopSettings
): Promise<void> {
  const member = await db.vip_members.findUnique({
    where: { id: memberId },
  });

  if (!member) return;

  // Check if member has any active subscriptions
  const activeSubscriptions = await db.vip_subscriptions.count({
    where: {
      member_id: memberId,
      status: "active",
    },
  });

  // If no active subscriptions, downgrade to LITE
  if (activeSubscriptions === 0 && member.tier !== "LITE") {
    await db.vip_members.update({
      where: { id: memberId },
      data: {
        tier: "LITE",
        points_multiplier: getTierMultiplier(settings, "LITE"),
        academy_access: getAcademyAccess(settings, "LITE"),
        tier_started_at: new Date(),
      },
    });

    console.log(`[TierManager] Downgraded member ${memberId} to LITE tier`);
  }
}

/**
 * Upgrade member to CLUB tier when they subscribe
 */
export async function upgradeToClubOnSubscription(
  memberId: string,
  settings: ShopSettings
): Promise<void> {
  const member = await db.vip_members.findUnique({
    where: { id: memberId },
  });

  if (!member || member.tier !== "LITE") return;

  await db.vip_members.update({
    where: { id: memberId },
    data: {
      tier: "CLUB",
      points_multiplier: getTierMultiplier(settings, "CLUB"),
      academy_access: getAcademyAccess(settings, "CLUB"),
      tier_started_at: new Date(),
    },
  });

  console.log(`[TierManager] Upgraded member ${memberId} to CLUB tier via subscription`);
}

/**
 * Check if tier should be upgraded
 */
function shouldUpgrade(currentTier: VipTier, newTier: VipTier): boolean {
  const tierOrder: VipTier[] = ["LITE", "CLUB", "CLUB_PLUS"];
  return tierOrder.indexOf(newTier) > tierOrder.indexOf(currentTier);
}
