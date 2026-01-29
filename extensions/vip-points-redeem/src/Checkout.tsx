import {
  reactExtension,
  useApi,
  useCustomer,
  useApplyDiscountCodeChange,
  useDiscountCodes,
  Banner,
  BlockStack,
  Button,
  Divider,
  Heading,
  Icon,
  InlineLayout,
  SkeletonText,
  Text,
} from "@shopify/ui-extensions-react/checkout";
import { useState, useEffect, useCallback } from "react";

// Types
interface Reward {
  id: string;
  name: string;
  pointsCost: number;
  discountValue: number;
  discountType: "fixed" | "percentage";
}

interface MemberData {
  id: string;
  customerId: string;
  points: number;
  tier: string;
  rewards: Reward[];
}

interface RedeemResponse {
  success: boolean;
  discountCode?: string;
  error?: string;
}

type LoadingState = "idle" | "loading" | "success" | "error";

// Main extension
export default reactExtension("purchase.checkout.block.render", () => (
  <VIPPointsRedemption />
));

function VIPPointsRedemption() {
  const { shop, sessionToken } = useApi();
  const customer = useCustomer();
  const applyDiscountCode = useApplyDiscountCodeChange();
  const discountCodes = useDiscountCodes();

  const [memberData, setMemberData] = useState<MemberData | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [appliedReward, setAppliedReward] = useState<string | null>(null);

  // Check if customer already has a VIP discount applied
  const hasVipDiscount = discountCodes.some(
    (dc) => dc.code?.startsWith("VIP-") || dc.code?.startsWith("REWARD-")
  );

  // Fetch member data from app proxy
  const fetchMemberData = useCallback(async () => {
    if (!customer?.id) return;

    setLoadingState("loading");
    setError(null);

    try {
      const token = await sessionToken.get();
      const shopDomain = shop.myshopifyDomain;
      
      // Extract numeric customer ID from gid
      const customerId = customer.id.replace("gid://shopify/Customer/", "");

      const response = await fetch(
        `https://${shopDomain}/apps/vip/member?customer_id=${customerId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          // Customer is not a VIP member yet
          setMemberData(null);
          setLoadingState("success");
          return;
        }
        throw new Error(`Failed to fetch member data: ${response.status}`);
      }

      const data = await response.json();
      setMemberData(data);
      setLoadingState("success");
    } catch (err) {
      console.error("Error fetching member data:", err);
      setError(err instanceof Error ? err.message : "Failed to load VIP data");
      setLoadingState("error");
    }
  }, [customer?.id, shop.myshopifyDomain, sessionToken]);

  // Fetch on mount and when customer changes
  useEffect(() => {
    if (customer?.id) {
      fetchMemberData();
    } else {
      setLoadingState("success");
    }
  }, [customer?.id, fetchMemberData]);

  // Redeem a reward
  const handleRedeem = useCallback(
    async (reward: Reward) => {
      if (!memberData || redeeming) return;

      setRedeeming(reward.id);
      setError(null);

      try {
        const token = await sessionToken.get();
        const shopDomain = shop.myshopifyDomain;

        const response = await fetch(
          `https://${shopDomain}/apps/vip/redeem`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              memberId: memberData.id,
              rewardId: reward.id,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to redeem reward");
        }

        const data: RedeemResponse = await response.json();

        if (!data.success || !data.discountCode) {
          throw new Error(data.error || "Redemption failed");
        }

        // Apply the discount code to checkout
        const result = await applyDiscountCode({
          type: "addDiscountCode",
          code: data.discountCode,
        });

        if (result.type === "error") {
          throw new Error("Failed to apply discount code");
        }

        // Update local state
        setAppliedReward(reward.name);
        setMemberData((prev) =>
          prev
            ? {
                ...prev,
                points: prev.points - reward.pointsCost,
              }
            : null
        );
      } catch (err) {
        console.error("Error redeeming reward:", err);
        setError(
          err instanceof Error ? err.message : "Failed to redeem reward"
        );
      } finally {
        setRedeeming(null);
      }
    },
    [memberData, redeeming, sessionToken, shop.myshopifyDomain, applyDiscountCode]
  );

  // Format currency
  const formatDiscount = (reward: Reward): string => {
    if (reward.discountType === "percentage") {
      return `${reward.discountValue}% off`;
    }
    return `$${reward.discountValue.toFixed(2)} off`;
  };

  // Render loading state
  if (loadingState === "loading") {
    return (
      <BlockStack spacing="tight">
        <Heading level={2}>🎁 VIP Points</Heading>
        <SkeletonText inlineSize="large" />
        <SkeletonText inlineSize="small" />
      </BlockStack>
    );
  }

  // Render error state
  if (loadingState === "error" && error) {
    return (
      <Banner status="warning" title="VIP Points Unavailable">
        <Text>Unable to load your VIP points. Please try again later.</Text>
      </Banner>
    );
  }

  // Customer not logged in
  if (!customer) {
    return (
      <Banner status="info" title="VIP Points Available">
        <Text>Log in to use your VIP points for discounts!</Text>
      </Banner>
    );
  }

  // Customer is not a VIP member
  if (!memberData) {
    return (
      <Banner status="info" title="Join our VIP Program!">
        <Text>Earn points on this order and unlock exclusive rewards.</Text>
      </Banner>
    );
  }

  // Customer has no points
  if (memberData.points === 0) {
    return (
      <BlockStack spacing="tight">
        <Heading level={2}>🎁 VIP Points</Heading>
        <Text appearance="subdued">
          You have 0 points. Complete this order to start earning!
        </Text>
      </BlockStack>
    );
  }

  // VIP discount already applied
  if (hasVipDiscount || appliedReward) {
    return (
      <Banner status="success" title="VIP Reward Applied!">
        <Text>
          {appliedReward
            ? `${appliedReward} has been applied to your order.`
            : "Your VIP discount is applied."}
        </Text>
      </Banner>
    );
  }

  // Get available rewards (ones the customer can afford)
  const availableRewards = memberData.rewards.filter(
    (r) => r.pointsCost <= memberData.points
  );

  // Show points balance and redemption options
  return (
    <BlockStack spacing="base">
      <InlineLayout columns={["auto", "fill"]} spacing="tight">
        <Icon source="discount" />
        <Heading level={2}>VIP Points</Heading>
      </InlineLayout>

      <InlineLayout columns={["fill", "auto"]} spacing="tight">
        <Text>Your balance:</Text>
        <Text emphasis="bold">{memberData.points.toLocaleString()} points</Text>
      </InlineLayout>

      {memberData.tier && (
        <Text appearance="subdued" size="small">
          {memberData.tier} Member
        </Text>
      )}

      {error && (
        <Banner status="critical">
          <Text>{error}</Text>
        </Banner>
      )}

      {availableRewards.length > 0 ? (
        <>
          <Divider />
          <Text emphasis="bold">Redeem your points:</Text>
          <BlockStack spacing="tight">
            {availableRewards.map((reward) => (
              <InlineLayout
                key={reward.id}
                columns={["fill", "auto"]}
                spacing="base"
                blockAlignment="center"
              >
                <BlockStack spacing="none">
                  <Text emphasis="bold">{reward.name}</Text>
                  <Text appearance="subdued" size="small">
                    {reward.pointsCost.toLocaleString()} points →{" "}
                    {formatDiscount(reward)}
                  </Text>
                </BlockStack>
                <Button
                  kind="secondary"
                  loading={redeeming === reward.id}
                  disabled={redeeming !== null}
                  onPress={() => handleRedeem(reward)}
                >
                  Redeem
                </Button>
              </InlineLayout>
            ))}
          </BlockStack>
        </>
      ) : (
        <Text appearance="subdued" size="small">
          Keep earning! You need more points to unlock rewards.
        </Text>
      )}
    </BlockStack>
  );
}
