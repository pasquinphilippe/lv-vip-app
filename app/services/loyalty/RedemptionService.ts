import db from "~/db.server";
import type { vip_members, loyalty_rewards } from "@prisma/client";
import crypto from "crypto";

export interface RedemptionResult {
  success: boolean;
  error?: string;
  redemptionId?: string;
  discountCode?: string;
  pointsSpent?: number;
}

/**
 * Validate that a member can redeem a reward
 */
function validateRedemption(
  member: vip_members,
  reward: loyalty_rewards,
): { valid: boolean; error?: string } {
  // Check if reward is active
  if (!reward.is_active) {
    return { valid: false, error: "Cette récompense n'est plus disponible." };
  }

  // Check points balance
  if (member.points_balance < reward.points_cost) {
    return {
      valid: false,
      error: `Points insuffisants. Vous avez ${member.points_balance} pts, il en faut ${reward.points_cost}.`,
    };
  }

  // Check tier requirement
  if (reward.tier_required) {
    const tierOrder = ["LITE", "CLUB", "CLUB_PLUS"];
    const memberTierIndex = tierOrder.indexOf(member.tier);
    const requiredTierIndex = tierOrder.indexOf(reward.tier_required);
    if (memberTierIndex < requiredTierIndex) {
      const tierLabels: Record<string, string> = {
        CLUB: "Club",
        CLUB_PLUS: "Club+",
      };
      return {
        valid: false,
        error: `Niveau ${tierLabels[reward.tier_required] || reward.tier_required} requis pour cette récompense.`,
      };
    }
  }

  // Check stock
  if (reward.stock_limited && (reward.stock_count === null || reward.stock_count <= 0)) {
    return { valid: false, error: "Cette récompense est en rupture de stock." };
  }

  return { valid: true };
}

/**
 * Generate a unique discount code for the redemption
 */
function generateDiscountCode(rewardType: string): string {
  const prefix = "LVVIP";
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${random}`;
}

/**
 * Create a Shopify discount code via Admin API
 */
export async function createShopifyDiscountCode(
  admin: any,
  reward: loyalty_rewards,
  code: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Only create Shopify discount for discount/shipping types
    if (reward.type !== "discount" && reward.type !== "shipping") {
      return { success: true }; // No Shopify discount needed
    }

    if (reward.type === "shipping") {
      // Free shipping discount
      const response = await admin.graphql(
        `#graphql
        mutation discountCodeFreeShippingCreate($freeShippingCodeDiscount: DiscountCodeFreeShippingInput!) {
          discountCodeFreeShippingCreate(freeShippingCodeDiscount: $freeShippingCodeDiscount) {
            codeDiscountNode {
              id
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            freeShippingCodeDiscount: {
              title: `VIP Reward: ${reward.name}`,
              code,
              startsAt: new Date().toISOString(),
              endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              usageLimit: 1,
              appliesOnOneTimePurchase: true,
              appliesOnSubscription: true,
              maximumShippingPrice: null,
              destination: {
                all: true,
              },
              customerSelection: {
                all: true,
              },
            },
          },
        },
      );
      const data = await response.json();
      const errors = data.data?.discountCodeFreeShippingCreate?.userErrors;
      if (errors && errors.length > 0) {
        console.error("[RedemptionService] Shopify discount error:", errors);
        return { success: false, error: errors[0].message };
      }
      return { success: true };
    }

    // Fixed amount or percentage discount
    if (reward.discount_type === "percentage") {
      const response = await admin.graphql(
        `#graphql
        mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
          discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
            codeDiscountNode {
              id
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            basicCodeDiscount: {
              title: `VIP Reward: ${reward.name}`,
              code,
              startsAt: new Date().toISOString(),
              endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              usageLimit: 1,
              customerSelection: {
                all: true,
              },
              customerGets: {
                value: {
                  percentage: Number(reward.discount_value) / 100,
                },
                items: {
                  all: true,
                },
              },
            },
          },
        },
      );
      const data = await response.json();
      const errors = data.data?.discountCodeBasicCreate?.userErrors;
      if (errors && errors.length > 0) {
        console.error("[RedemptionService] Shopify discount error:", errors);
        return { success: false, error: errors[0].message };
      }
      return { success: true };
    }

    // Fixed amount discount
    const response = await admin.graphql(
      `#graphql
      mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode {
            id
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          basicCodeDiscount: {
            title: `VIP Reward: ${reward.name}`,
            code,
            startsAt: new Date().toISOString(),
            endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            usageLimit: 1,
            customerSelection: {
              all: true,
            },
            customerGets: {
              value: {
                discountAmount: {
                  amount: Number(reward.discount_value),
                  appliesOnEachItem: false,
                },
              },
              items: {
                all: true,
              },
            },
          },
        },
      },
    );
    const data = await response.json();
    const errors = data.data?.discountCodeBasicCreate?.userErrors;
    if (errors && errors.length > 0) {
      console.error("[RedemptionService] Shopify discount error:", errors);
      return { success: false, error: errors[0].message };
    }
    return { success: true };
  } catch (err) {
    console.error("[RedemptionService] Failed to create Shopify discount:", err);
    return { success: false, error: "Erreur lors de la création du code promo." };
  }
}

/**
 * Process a reward redemption
 */
export async function processRedemption(
  memberId: string,
  rewardId: string,
  admin?: any,
): Promise<RedemptionResult> {
  // Get member and reward
  const [member, reward] = await Promise.all([
    db.vip_members.findUnique({ where: { id: memberId } }),
    db.loyalty_rewards.findUnique({ where: { id: rewardId } }),
  ]);

  if (!member) {
    return { success: false, error: "Membre introuvable." };
  }
  if (!reward) {
    return { success: false, error: "Récompense introuvable." };
  }

  // Validate
  const validation = validateRedemption(member, reward);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Generate discount code
  const discountCode = generateDiscountCode(reward.type);

  // Create Shopify discount code if admin API is available
  if (admin && (reward.type === "discount" || reward.type === "shipping")) {
    const shopifyResult = await createShopifyDiscountCode(admin, reward, discountCode);
    if (!shopifyResult.success) {
      return { success: false, error: shopifyResult.error };
    }
  }

  // Use a transaction
  const result = await db.$transaction(async (tx) => {
    // Deduct points
    await tx.vip_members.update({
      where: { id: memberId },
      data: {
        points_balance: { decrement: reward.points_cost },
      },
    });

    // Create ledger entry
    await tx.loyalty_points_ledger.create({
      data: {
        member_id: memberId,
        points: -reward.points_cost,
        action: "redeem",
        description: `Échange: ${reward.name_fr || reward.name}`,
        reference_type: "redemption",
        reference_id: rewardId,
      },
    });

    // Create redemption record
    const redemption = await tx.loyalty_redemptions.create({
      data: {
        member_id: memberId,
        reward_id: rewardId,
        points_spent: reward.points_cost,
        status: "pending",
        shopify_discount_code: discountCode,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    // Decrease stock if limited
    if (reward.stock_limited && reward.stock_count !== null) {
      await tx.loyalty_rewards.update({
        where: { id: rewardId },
        data: { stock_count: { decrement: 1 } },
      });
    }

    return redemption;
  });

  console.log(
    `[RedemptionService] Member ${memberId} redeemed ${reward.name} for ${reward.points_cost} pts → code ${discountCode}`,
  );

  return {
    success: true,
    redemptionId: result.id,
    discountCode,
    pointsSpent: reward.points_cost,
  };
}
