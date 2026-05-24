/**
 * Google Play Billing product IDs.
 *
 * These must EXACTLY match the product IDs you create in Play Console
 * (Monetize → Subscriptions / In-app products). The product configuration
 * (price, trial period, name) lives in Play Console; we only know the IDs.
 *
 * To create the products in Play Console:
 *
 *   SUBSCRIPTIONS (Monetize → Subscriptions → Create subscription):
 *     - freeresume_premium_monthly  →  $2.99/month, 3-day free trial
 *     - freeresume_premium_annual   →  $19.99/year, 7-day free trial
 *
 *   IN-APP PRODUCT (Monetize → In-app products → Create):
 *     - freeresume_premium_lifetime →  $29.99 one-time (managed product)
 *
 * After creating, activate each one (top-right of each product page). It
 * can take 1-4 hours after creation before they're billable, even on the
 * internal testing track.
 */

export const PRODUCT_IDS = {
  monthly: 'freeresume_premium_monthly',
  annual: 'freeresume_premium_annual',
  lifetime: 'freeresume_premium_lifetime',
} as const;

export const SUBSCRIPTION_SKUS = [PRODUCT_IDS.monthly, PRODUCT_IDS.annual];
export const ONE_TIME_SKUS = [PRODUCT_IDS.lifetime];
export const ALL_SKUS = [...SUBSCRIPTION_SKUS, ...ONE_TIME_SKUS];

export type ProductTier = 'monthly' | 'annual' | 'lifetime';

export function tierOfSku(sku: string): ProductTier | null {
  if (sku === PRODUCT_IDS.monthly) return 'monthly';
  if (sku === PRODUCT_IDS.annual) return 'annual';
  if (sku === PRODUCT_IDS.lifetime) return 'lifetime';
  return null;
}

export function isLifetimeSku(sku: string): boolean {
  return sku === PRODUCT_IDS.lifetime;
}
