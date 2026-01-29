import type { ActionFunctionArgs } from "react-router";
import prisma from "../db.server";
import { verifyAppProxySignature, getProxyCustomerId } from "~/services/proxy/verifyProxy";
import { processRedemption } from "~/services/loyalty";

/**
 * App Proxy Route: POST /apps/vip/redeem
 *
 * Redeems points for a reward.
 * Body: { rewardId: string }
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const url = new URL(request.url);

  // Verify Shopify signature
  if (!verifyAppProxySignature(url)) {
    return Response.json(
      { error: "Signature invalide" },
      { status: 401 },
    );
  }

  if (request.method !== "POST") {
    return Response.json(
      { error: "Méthode non autorisée" },
      { status: 405 },
    );
  }

  const customerId = getProxyCustomerId(url);
  if (!customerId) {
    return Response.json(
      { error: "Vous devez être connecté pour échanger des points." },
      { status: 401 },
    );
  }

  // Parse body
  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  const { rewardId } = body;
  if (!rewardId) {
    return Response.json(
      { error: "rewardId requis." },
      { status: 400 },
    );
  }

  // Find member by Shopify customer ID
  const member = await prisma.vip_members.findFirst({
    where: {
      OR: [
        { shopify_customer_id_coloration: customerId },
        { shopify_customer_id_haircare: customerId },
      ],
    },
  });

  if (!member) {
    return Response.json(
      { error: "Vous n'êtes pas encore membre VIP." },
      { status: 404 },
    );
  }

  // Process redemption (no Shopify admin API from proxy — discount code only in DB)
  // Note: For proxy redemptions without admin context, we create the redemption
  // and generate a code. The discount will be created when admin processes it,
  // or the customer uses the code at checkout via a script.
  const result = await processRedemption(member.id, rewardId);

  if (!result.success) {
    return Response.json(
      { error: result.error },
      { status: 400 },
    );
  }

  return Response.json({
    success: true,
    discount_code: result.discountCode,
    points_spent: result.pointsSpent,
    message: `Félicitations! Utilisez le code ${result.discountCode} lors de votre prochaine commande.`,
  });
};

// Also handle GET requests with a friendly message
export const loader = async () => {
  return Response.json({
    error: "Utilisez POST pour échanger des points.",
  }, { status: 405 });
};
