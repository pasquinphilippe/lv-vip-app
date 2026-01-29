// Settings Service
export {
  getShopSettings,
  updateShopSettings,
  invalidateSettingsCache,
  getTierMultiplier,
  getAcademyAccess,
  type ShopSettings,
  type TierThresholds,
  type TierConfig,
} from "./SettingsService";

// Points Calculator
export {
  calculatePurchasePoints,
  calculateRegularPurchasePoints,
  calculateSubscriptionPurchasePoints,
  calculateSubscriptionMilestoneBonus,
  calculateSubscriptionPoints,
  calculateNewMemberPurchasePoints,
  getWelcomeBonus,
  getMilestoneBonus,
  type PurchasePointsInput,
  type SubscriptionMilestoneInput,
  type SubscriptionPointsInput,
} from "./PointsCalculator";

// Tier Manager
export {
  determineTier,
  checkAndUpgradeTier,
  downgradeTier,
  upgradeToClubOnSubscription,
  type VipTier,
  type TierUpgradeResult,
} from "./TierManager";

// Referral Service
export {
  generateReferralCode,
  extractReferralCode,
  processReferralReward,
  createReferralEvent,
  isReferralCode,
  type ReferralRewardResult,
  type OrderDiscountCode,
} from "./ReferralService";

// Birthday Service
export {
  isWithinBirthdayWindow,
  hasClaimedBirthdayThisYear,
  checkAndAwardBirthdayPoints,
  getMembersWithBirthdayToday,
  updateMemberBirthday,
  type BirthdayRewardResult,
} from "./BirthdayService";

// Redemption Service
export {
  processRedemption,
  createShopifyDiscountCode,
  type RedemptionResult,
} from "./RedemptionService";
