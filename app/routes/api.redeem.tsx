import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { processRedemption } from "~/services/loyalty";

/**
 * API Route: POST /api/redeem
 * Called from the admin app to process a reward redemption.
 *
 * Body: { memberId: string, rewardId: string }
 * Returns: { success, error?, discountCode?, pointsSpent? }
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const { memberId, rewardId } = body;

  if (!memberId || !rewardId) {
    return Response.json(
      { error: "memberId et rewardId requis." },
      { status: 400 },
    );
  }

  const result = await processRedemption(memberId, rewardId, admin);

  if (!result.success) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({
    success: true,
    redemptionId: result.redemptionId,
    discountCode: result.discountCode,
    pointsSpent: result.pointsSpent,
  });
};
