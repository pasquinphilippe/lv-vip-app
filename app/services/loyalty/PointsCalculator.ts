import type { ShopSettings } from "./SettingsService";
import type { vip_members } from "@prisma/client";

export interface PurchasePointsInput {
  totalPrice: number;
  isSubscriptionOrder?: boolean;
  member?: vip_members;
  settings: ShopSettings;
}

export interface SubscriptionMilestoneInput {
  subscriptionStartDate: Date;
  settings: ShopSettings;
}

/**
 * Calculate points earned from a purchase
 * Applies member's tier multiplier if available
 * Simple hardcoded rates:
 * - Subscription orders: 200 points per dollar
 * - Regular orders: 100 points per dollar
 */
export function calculatePurchasePoints({
  totalPrice,
  isSubscriptionOrder = false,
  member,
  settings,
}: PurchasePointsInput): number {
  if (!settings.loyalty_enabled) {
    return 0;
  }

  const pointsPerDollar = isSubscriptionOrder
    ? settings.subscription_points_per_dollar
    : settings.regular_points_per_dollar;

  // Apply tier multiplier if member is provided
  const tierMultiplier = member?.points_multiplier || 1.0;

  return Math.floor(totalPrice * pointsPerDollar * tierMultiplier);
}

/**
 * Calculate points for a regular (non-subscription) purchase
 */
export function calculateRegularPurchasePoints(
  totalPrice: number,
  settings: ShopSettings
): number {
  if (!settings.loyalty_enabled) {
    return 0;
  }

  return Math.floor(totalPrice * settings.regular_points_per_dollar);
}

/**
 * Calculate points for a subscription purchase
 */
export function calculateSubscriptionPurchasePoints(
  totalPrice: number,
  settings: ShopSettings
): number {
  if (!settings.loyalty_enabled) {
    return 0;
  }

  return Math.floor(totalPrice * settings.subscription_points_per_dollar);
}

/**
 * Check if subscriber has reached a milestone anniversary
 * Returns bonus points if they have, 0 otherwise
 */
export function calculateSubscriptionMilestoneBonus({
  subscriptionStartDate,
  settings,
}: SubscriptionMilestoneInput): { 
  eligible: boolean; 
  monthsActive: number; 
  bonusPoints: number;
} {
  if (!settings.loyalty_enabled) {
    return { eligible: false, monthsActive: 0, bonusPoints: 0 };
  }

  const now = new Date();
  const startDate = new Date(subscriptionStartDate);
  
  // Calculate months active
  const monthsDiff = 
    (now.getFullYear() - startDate.getFullYear()) * 12 + 
    (now.getMonth() - startDate.getMonth());

  const milestoneMonths = settings.subscription_milestone_months;
  
  // Check if this is a milestone month (every N months)
  if (monthsDiff > 0 && monthsDiff % milestoneMonths === 0) {
    return {
      eligible: true,
      monthsActive: monthsDiff,
      bonusPoints: settings.subscription_milestone_bonus,
    };
  }

  return { eligible: false, monthsActive: monthsDiff, bonusPoints: 0 };
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
 * Get tier upgrade milestone bonus points
 * Awarded when a member reaches a new tier
 */
export function getMilestoneBonus(settings: ShopSettings): number {
  if (!settings.loyalty_enabled) {
    return 0;
  }

  // Use subscription_milestone_bonus for tier upgrades as well
  // This could be made configurable separately in the future
  return settings.subscription_milestone_bonus || 500;
}

export interface SubscriptionPointsInput {
  isNewSubscription: boolean;
  settings: ShopSettings;
}

/**
 * Calculate points for subscription events (new signup or renewal)
 */
export function calculateSubscriptionPoints({
  isNewSubscription,
  settings,
}: SubscriptionPointsInput): number {
  if (!settings.loyalty_enabled) {
    return 0;
  }

  // New subscriptions get welcome bonus, renewals get milestone bonus
  if (isNewSubscription) {
    return settings.welcome_bonus || 0;
  }

  // Renewal points - use subscription milestone bonus
  return settings.subscription_milestone_bonus || 500;
}

/**
 * Calculate points for a new member's first purchase
 * Includes welcome bonus if configured
 */
export function calculateNewMemberPurchasePoints(
  totalPrice: number,
  settings: ShopSettings
): number {
  if (!settings.loyalty_enabled) {
    return 0;
  }

  // Base points from purchase (LITE rate)
  const purchasePoints = Math.floor(totalPrice * settings.regular_points_per_dollar);
  
  // Add welcome bonus
  const welcomeBonus = settings.welcome_bonus || 0;

  return purchasePoints + welcomeBonus;
}
