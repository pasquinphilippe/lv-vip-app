import {
  reactExtension,
  useApi,
  useCustomer,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Divider,
  SkeletonText,
  Banner,
  Icon,
  Card,
} from "@shopify/ui-extensions-react/customer-account";
import { useState, useEffect } from "react";

interface PointsTransaction {
  id: string;
  date: string;
  description: string;
  points: number;
  type: "earn" | "redeem";
}

interface MemberData {
  points: number;
  tier: "LITE" | "CLUB" | "CLUB+";
  tierProgress: {
    current: number;
    next: number;
    nextTier: string | null;
  };
  history: PointsTransaction[];
}

export default reactExtension(
  "customer-account.order-index.block.render",
  () => <VIPPointsBlock />
);

function VIPPointsBlock() {
  const { sessionToken } = useApi<"customer-account.order-index.block.render">();
  const customer = useCustomer();
  
  const [memberData, setMemberData] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMemberData() {
      try {
        const token = await sessionToken.get();
        
        // Fetch from app proxy
        const response = await fetch("/apps/vip/member", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            // Customer not enrolled yet
            setMemberData(null);
            setLoading(false);
            return;
          }
          throw new Error("Failed to fetch VIP data");
        }

        const data = await response.json();
        setMemberData(data);
      } catch (err) {
        console.error("Error fetching VIP member data:", err);
        setError("Unable to load your VIP status");
      } finally {
        setLoading(false);
      }
    }

    fetchMemberData();
  }, [sessionToken]);

  if (loading) {
    return (
      <Card>
        <BlockStack spacing="base">
          <Text emphasis="bold" size="large">Mes points VIP</Text>
          <SkeletonText lines={3} />
        </BlockStack>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Banner status="critical" title="Erreur">
          <Text>{error}</Text>
        </Banner>
      </Card>
    );
  }

  if (!memberData) {
    return (
      <Card>
        <BlockStack spacing="base">
          <Text emphasis="bold" size="large">Programme VIP</Text>
          <Text appearance="subdued">
            Vous n'êtes pas encore membre du programme VIP. 
            Passez votre première commande pour commencer à accumuler des points!
          </Text>
        </BlockStack>
      </Card>
    );
  }

  const tierColors: Record<string, "info" | "success" | "warning"> = {
    LITE: "info",
    CLUB: "success",
    "CLUB+": "warning",
  };

  return (
    <Card>
      <BlockStack spacing="loose">
        {/* Header with tier */}
        <InlineStack spacing="base" blockAlignment="center">
          <Text emphasis="bold" size="large">Mes points VIP</Text>
          <Badge tone={tierColors[memberData.tier] || "info"}>
            {memberData.tier}
          </Badge>
        </InlineStack>

        {/* Points balance */}
        <BlockStack spacing="tight">
          <Text size="extraLarge" emphasis="bold">
            {memberData.points.toLocaleString("fr-CA")} points
          </Text>
          
          {memberData.tierProgress.nextTier && (
            <Text appearance="subdued" size="small">
              Plus que {(memberData.tierProgress.next - memberData.tierProgress.current).toLocaleString("fr-CA")} points pour atteindre {memberData.tierProgress.nextTier}
            </Text>
          )}
          
          {!memberData.tierProgress.nextTier && (
            <Text appearance="subdued" size="small">
              🎉 Vous avez atteint le niveau maximum!
            </Text>
          )}
        </BlockStack>

        <Divider />

        {/* Recent activity */}
        <BlockStack spacing="base">
          <Text emphasis="bold">Activité récente</Text>
          
          {memberData.history.length === 0 ? (
            <Text appearance="subdued">Aucune activité récente</Text>
          ) : (
            <BlockStack spacing="tight">
              {memberData.history.slice(0, 5).map((transaction) => (
                <InlineStack key={transaction.id} spacing="base" blockAlignment="center">
                  <BlockStack spacing="none">
                    <Text size="small">{transaction.description}</Text>
                    <Text size="small" appearance="subdued">
                      {new Date(transaction.date).toLocaleDateString("fr-CA")}
                    </Text>
                  </BlockStack>
                  <Text 
                    emphasis="bold" 
                    appearance={transaction.type === "earn" ? "success" : "critical"}
                  >
                    {transaction.type === "earn" ? "+" : "-"}
                    {transaction.points.toLocaleString("fr-CA")}
                  </Text>
                </InlineStack>
              ))}
            </BlockStack>
          )}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
