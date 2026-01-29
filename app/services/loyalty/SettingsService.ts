import db from "~/db.server";
import type { shop_settings, Prisma } from "@prisma/client";

// Types for tier configuration
export interface TierThresholds {
  CLUB: number;
  CLUB_PLUS: number;
}

export interface TierConfig {
  LITE: { multiplier: number; academy: string };
  CLUB: { multiplier: number; academy: string };
  CLUB_PLUS: { multiplier: number; academy: string };
}

export interface ShopSettings extends shop_settings {
  tierThresholds: TierThresholds;
  tierConfig: TierConfig;
}

// Default tier thresholds
const DEFAULT_TIER_THRESHOLDS: TierThresholds = {
  CLUB: 1000,
  CLUB_PLUS: 5000,
};

// Default tier configuration
const DEFAULT_TIER_CONFIG: TierConfig = {
  LITE: { multiplier: 1.5, academy: "basic" },
  CLUB: { multiplier: 2.0, academy: "full" },
  CLUB_PLUS: { multiplier: 3.5, academy: "premium" },
};

// Cache for settings with TTL
const settingsCache = new Map<
  string,
  { settings: ShopSettings; timestamp: number }
>();
const CACHE_TTL = 60000; // 1 minute

/**
 * Get shop settings with caching
 */
export async function getShopSettings(
  shopDomain: string
): Promise<ShopSettings> {
  // Check cache first
  const cached = settingsCache.get(shopDomain);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.settings;
  }

  // Fetch from database
  let rawSettings = await db.shop_settings.findUnique({
    where: { shop_domain: shopDomain },
  });

  // Create default settings if none exist
  if (!rawSettings) {
    rawSettings = await db.shop_settings.create({
      data: {
        shop_domain: shopDomain,
        tier_thresholds: DEFAULT_TIER_THRESHOLDS as unknown as Prisma.InputJsonValue,
        tier_config: DEFAULT_TIER_CONFIG as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // Parse JSON fields with defaults
  const settings: ShopSettings = {
    ...rawSettings,
    tierThresholds: (rawSettings.tier_thresholds as unknown as TierThresholds) || DEFAULT_TIER_THRESHOLDS,
    tierConfig: (rawSettings.tier_config as unknown as TierConfig) || DEFAULT_TIER_CONFIG,
  };

  // Cache the settings
  settingsCache.set(shopDomain, { settings, timestamp: Date.now() });

  return settings;
}

/**
 * Update shop settings
 */
export async function updateShopSettings(
  shopDomain: string,
  updates: Record<string, unknown>
): Promise<ShopSettings> {
  // Convert JSON fields to proper Prisma input types
  const prismaUpdates = { ...updates } as Prisma.shop_settingsUpdateInput;

  await db.shop_settings.upsert({
    where: { shop_domain: shopDomain },
    update: prismaUpdates,
    create: {
      shop_domain: shopDomain,
      ...prismaUpdates,
    } as Prisma.shop_settingsCreateInput,
  });

  // Invalidate cache
  settingsCache.delete(shopDomain);

  return getShopSettings(shopDomain);
}

/**
 * Invalidate settings cache for a shop
 */
export function invalidateSettingsCache(shopDomain: string): void {
  settingsCache.delete(shopDomain);
}

/**
 * Get tier multiplier from settings
 */
export function getTierMultiplier(
  settings: ShopSettings,
  tier: string
): number {
  const tierKey = tier as keyof TierConfig;
  return settings.tierConfig[tierKey]?.multiplier || 1.0;
}

/**
 * Get academy access level from settings
 */
export function getAcademyAccess(
  settings: ShopSettings,
  tier: string
): string {
  const tierKey = tier as keyof TierConfig;
  return settings.tierConfig[tierKey]?.academy || "basic";
}
