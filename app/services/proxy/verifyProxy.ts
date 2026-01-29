import crypto from "crypto";

/**
 * Verify Shopify App Proxy signature
 *
 * Shopify sends query parameters signed with the app's API secret.
 * See: https://shopify.dev/docs/apps/online-store/app-proxies#verify-the-origin-of-the-request
 */
export function verifyAppProxySignature(url: URL): boolean {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    console.error("[Proxy] SHOPIFY_API_SECRET not set");
    return false;
  }

  const params = url.searchParams;
  const signature = params.get("signature");
  if (!signature) {
    return false;
  }

  // Build query string from all params except signature, sorted alphabetically
  const sortedParams = Array.from(params.entries())
    .filter(([key]) => key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("");

  const computed = crypto
    .createHmac("sha256", secret)
    .update(sortedParams)
    .digest("hex");

  return computed === signature;
}

/**
 * Extract customer ID from params
 * - logged_in_customer_id: Shopify sends this when customer is logged in via App Proxy
 * - customer_id: Extension sends this explicitly
 */
export function getProxyCustomerId(url: URL): string | null {
  return url.searchParams.get("logged_in_customer_id") 
    || url.searchParams.get("customer_id") 
    || null;
}
