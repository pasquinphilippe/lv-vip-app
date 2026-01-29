import type { vip_members } from "@prisma/client";
import type { ShopSettings } from "./SettingsService";
import { getTierMultiplier } from "./SettingsService";

export interface PurchasePointsInput {
  totalPrice: number;
  member: vip_members;
  settings: ShopSettings;
}

export interface SubscriptionPointsInput {
  isNewSubscription: boolean;
  isReactivation?: boolean;
  settings: ShopSettings;
}

/**
 * Calculate points earned from a purchase
 */
export function calculatePurchasePoints({
  totalPrice,
  member,
  settings,
}: PurchasePointsInput): number {
  if (!settings.loyalty_enabled) {
    return 0;
  }

  // Base points = price * points per dollar
  const basePoints = Math.floor(totalPrice * settings.points_per_dollar);

  // Apply tier multiplier
  const multiplier = getTierMultiplier(settings, member.tier);
  const earnedPoints = Math.floor(basePoints * multiplier);

  return earnedPoints;
}

/**
 * Calculate points earned from a new member purchase (before member exists)
 */
export function calculateNewMemberPurchasePoints(
  totalPrice: number,
  settings: ShopSettings
): number {
  if (!settings.loyalty_enabled) {
    return 0;
  }

  const basePoints = Math.floor(totalPrice * settings.points_per_dollar);
  const liteMultiplier = getTierMultiplier(settings, "LITE");

  return Math.floor(basePoints * liteMultiplier);
}

/**
 * Calculate subscription-related points
 */
export function calculateSubscriptionPoints({
  isNewSubscription,
  isReactivation = false,
  settings,
}: SubscriptionPointsInput): number {
  if (!settings.loyalty_enabled) {
    return 0;
  }

  if (isReactivation) {
    return settings.reactivation_bonus;
  }

  return isNewSubscription
    ? settings.subscription_new_points
    : settings.subscription_renewal_points;
}

/**
 * Get welcome bonus points
 */
export function getWelcomeBonus(settings: ShopSettings): number {
  if (!settings.loyalty_enabled) {
    return 0;
  }

  return settings.welcome_bonus;
}

/**
 * Get milestone bonus points for tier upgrade
 */
export function getMilestoneBonus(settings: ShopSettings): number {
  if (!settings.loyalty_enabled) {
    return 0;
  }

  return settings.milestone_tier_bonus;
}
