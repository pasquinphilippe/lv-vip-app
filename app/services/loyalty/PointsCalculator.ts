import type { ShopSettings } from "./SettingsService";

export interface PurchasePointsInput {
  totalPrice: number;
  isSubscriptionOrder: boolean;
  settings: ShopSettings;
}

export interface SubscriptionMilestoneInput {
  subscriptionStartDate: Date;
  settings: ShopSettings;
}

/**
 * Calculate points earned from a purchase
 * Simple hardcoded rates:
 * - Subscription orders: 200 points per dollar
 * - Regular orders: 100 points per dollar
 */
export function calculatePurchasePoints({
  totalPrice,
  isSubscriptionOrder,
  settings,
}: PurchasePointsInput): number {
  if (!settings.loyalty_enabled) {
    return 0;
  }

  const pointsPerDollar = isSubscriptionOrder
    ? settings.subscription_points_per_dollar
    : settings.regular_points_per_dollar;

  return Math.floor(totalPrice * pointsPerDollar);
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
