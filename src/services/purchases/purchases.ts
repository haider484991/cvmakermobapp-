/**
 * expo-iap wrapper — direct Google Play Billing via the Expo-native
 * library. Replaces react-native-iap v15 (Nitro modules) which had
 * Metro/Expo SDK 54 compatibility issues.
 *
 * Design notes:
 *   - The `expo-iap` import is lazy + try/catched so the module can be
 *     loaded in Expo Go (no native binding) without crashing. The UI
 *     just shows the paywall in a "preview" state with mock prices.
 *   - Every public function is a safe no-op when the native module is
 *     unavailable.
 *   - All state changes go through `usePurchasesStore`.
 *   - We listen to the global purchase listener so the entitlement
 *     refreshes whether the user bought through the paywall, restored,
 *     or auto-renewed.
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';
import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';
import { usePurchasesStore } from '@/stores/purchasesStore';
import {
  ALL_SKUS,
  ONE_TIME_SKUS,
  SUBSCRIPTION_SKUS,
  tierOfSku,
} from './productIds';

export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let iap: any = null;
let connected = false;
let purchaseUpdateSub: { remove: () => void } | null = null;
let purchaseErrorSub: { remove: () => void } | null = null;

function devLog(...args: unknown[]) {
  if (__DEV__) console.log('[purchases]', ...args);
}

function loadIap(): any | null {
  if (iap) return iap;
  if (isExpoGo) {
    devLog('Expo Go — native billing unavailable');
    return null;
  }
  try {
    iap = require('expo-iap');
    return iap;
  } catch (err) {
    devLog('Native module unavailable', err);
    return null;
  }
}

/**
 * Idempotent. Connects to Google Play and starts the global purchase
 * listener. After this returns, the store's `activeTier` reflects what
 * the user actually owns.
 */
export async function initPurchases(): Promise<void> {
  const m = loadIap();
  if (!m) {
    usePurchasesStore.getState().setInitialized(true);
    return;
  }

  try {
    if (!connected) {
      await m.initConnection();
      connected = true;
    }

    // Global purchase listener — fires for paywall purchases, restores,
    // and subscription auto-renewals.
    purchaseUpdateSub = m.purchaseUpdatedListener(async (purchase: any) => {
      devLog('purchaseUpdated', purchase?.productId || purchase?.id);
      try {
        await handleSuccessfulPurchase(purchase);
      } catch (err) {
        devLog('purchaseUpdated handler failed', err);
      }
    });

    purchaseErrorSub = m.purchaseErrorListener((err: any) => {
      devLog('purchaseError', err?.code, err?.message);
      const code = err?.code;
      if (code === 'E_USER_CANCELLED' || code === 'user-cancelled') {
        usePurchasesStore.getState().setPurchasing(false);
        return;
      }
      // Friendly UI message that hints at the real cause without scaring users
      const friendlyMsg =
        code === 'query-product'
          ? 'This product is not available on your account right now. New products can take up to 24h to fully activate, or your Google account country may not be configured.'
          : err?.message || 'Purchase failed';
      usePurchasesStore.getState().setError(friendlyMsg);
      usePurchasesStore.getState().setPurchasing(false);
      track(ANALYTICS_EVENTS.PURCHASE_FAILED, {
        code: code || 'UNKNOWN',
        message: (err?.message || '').slice(0, 200),
        // Pull every field we can to diagnose remotely
        debugMessage: err?.debugMessage?.slice?.(0, 200),
        responseCode: err?.responseCode,
        productId: err?.productId,
        userInfo: JSON.stringify(err?.userInfo || {}).slice(0, 200),
      });
    });

    await refreshEntitlement();
    // Successful init — log so we can confirm in analytics
    track('purchases_init_success' as any, {
      iap_available: true,
    });
  } catch (err: any) {
    devLog('init failed', err);
    // CRITICAL: surface init failures to analytics so we can diagnose
    // "instant failed to query product" errors that are actually init
    // failures masquerading as query failures.
    track('purchases_init_failed' as any, {
      code: err?.code || 'UNKNOWN',
      message: (err?.message || String(err)).slice(0, 300),
      name: err?.name,
      stage: connected ? 'after_connect' : 'before_connect',
    });
    usePurchasesStore.getState().setInitialized(true);
  }
}

/**
 * Pull current entitlement from Google Play. Called on init and after
 * every purchase event. Safe to call frequently — Play caches the result.
 */
export async function refreshEntitlement(): Promise<void> {
  const m = loadIap();
  if (!m) return;

  try {
    const purchases: any[] = (await m.getAvailablePurchases()) || [];
    const owned = purchases.filter((p) => {
      const sku = p.productId || p.id || (p.productIds && p.productIds[0]);
      return ALL_SKUS.includes(sku);
    });

    if (owned.length === 0) {
      usePurchasesStore.getState().setEntitlement(null, null);
    } else {
      // Prefer lifetime > annual > monthly.
      const skuOf = (p: any) => p.productId || p.id || (p.productIds && p.productIds[0]);
      const priority = (sku: string) =>
        sku === 'freeresume_premium_lifetime' ? 3 :
        sku === 'freeresume_premium_annual' ? 2 : 1;
      const best = owned.sort((a, b) => priority(skuOf(b)) - priority(skuOf(a)))[0];
      const bestSku = skuOf(best);
      const tier = tierOfSku(bestSku);
      usePurchasesStore.getState().setEntitlement(tier, bestSku);
    }

    usePurchasesStore.getState().markSynced();
    usePurchasesStore.getState().setInitialized(true);
  } catch (err) {
    devLog('refreshEntitlement failed', err);
    usePurchasesStore.getState().setInitialized(true);
  }
}

async function handleSuccessfulPurchase(purchase: any): Promise<void> {
  const m = loadIap();
  if (!m) return;

  const sku = purchase?.productId || purchase?.id || (purchase?.productIds && purchase.productIds[0]);
  const tier = tierOfSku(sku);

  // Acknowledge / consume. expo-iap's finishTransaction handles both
  // subscription ack and one-time product completion based on isConsumable.
  try {
    await m.finishTransaction({ purchase, isConsumable: false });
  } catch (err) {
    devLog('finishTransaction failed (still recording entitlement)', err);
  }

  if (tier) {
    usePurchasesStore.getState().setEntitlement(tier, sku);
  }
  usePurchasesStore.getState().setPurchasing(false);
  usePurchasesStore.getState().setError(null);

  track(ANALYTICS_EVENTS.PURCHASE_COMPLETED, {
    sku,
    tier,
    purchase_token_prefix: (purchase.purchaseToken || purchase.transactionReceipt || '').slice(0, 8),
  });
}

/** Fetch product details for the paywall UI. */
export async function getOfferings(): Promise<Offering[]> {
  const m = loadIap();
  if (!m) return MOCK_OFFERINGS;

  try {
    const [subs, oneTimes] = await Promise.all([
      m.fetchProducts({ skus: SUBSCRIPTION_SKUS, type: 'subs' }).catch(() => []),
      m.fetchProducts({ skus: ONE_TIME_SKUS, type: 'in-app' }).catch(() => []),
    ]);

    const offerings: Offering[] = [];

    for (const s of subs || []) {
      const skuId = s.productId || s.id;
      const tier = tierOfSku(skuId);
      if (!tier) continue;
      // expo-iap surfaces Android subscription offer details slightly
      // differently per version; handle both shapes.
      const androidOffer =
        s.subscriptionOfferDetailsAndroid?.[0] ||
        s.subscriptionOfferDetails?.[0];
      const pricingPhases =
        androidOffer?.pricingPhases?.pricingPhaseList ||
        androidOffer?.pricingPhases;
      const paidPhase = pricingPhases?.find((p: any) => p.priceAmountMicros !== '0') ||
        pricingPhases?.[pricingPhases.length - 1];
      offerings.push({
        sku: skuId,
        tier,
        priceText: paidPhase?.formattedPrice || s.displayPrice || s.localizedPrice || '',
        period: tier === 'annual' ? 'year' : 'month',
        trialDays: parseTrialDays(pricingPhases),
        title: s.title || s.displayName || '',
      });
    }

    for (const p of oneTimes || []) {
      const skuId = p.productId || p.id;
      const tier = tierOfSku(skuId);
      if (!tier) continue;
      offerings.push({
        sku: skuId,
        tier,
        priceText: p.displayPrice || p.localizedPrice || '',
        period: 'lifetime',
        trialDays: 0,
        title: p.title || p.displayName || '',
      });
    }

    // Telemetry so we can see whether Play returned real prices or we
    // fell back to mocks — and what each product looked like raw.
    track('paywall_offerings_loaded' as any, {
      count: offerings.length,
      using_mocks: offerings.length === 0,
      raw_sub_count: (subs || []).length,
      raw_onetime_count: (oneTimes || []).length,
      raw_sub_skus: (subs || []).map((s: any) => s.productId || s.id).join(','),
      raw_onetime_skus: (oneTimes || []).map((p: any) => p.productId || p.id).join(','),
      first_sub_status: (subs || [])[0]?.productStatusAndroid,
    });

    return offerings.length > 0 ? offerings : MOCK_OFFERINGS;
  } catch (err: any) {
    devLog('getOfferings failed', err);
    // Surface the actual native error so we can diagnose remotely.
    track('paywall_offerings_failed' as any, {
      code: err?.code || 'UNKNOWN',
      message: (err?.message || String(err)).slice(0, 300),
      name: err?.name,
    });
    return MOCK_OFFERINGS;
  }
}

/**
 * Open the native purchase flow. Returns immediately — actual fulfillment
 * happens via the purchaseUpdatedListener registered in initPurchases().
 */
export async function buyProduct(sku: string): Promise<void> {
  const m = loadIap();
  if (!m) {
    usePurchasesStore
      .getState()
      .setError('In-app purchases unavailable in Expo Go. Use a dev/production build.');
    return;
  }

  usePurchasesStore.getState().setPurchasing(true);
  usePurchasesStore.getState().setError(null);

  track(ANALYTICS_EVENTS.PURCHASE_INITIATED, {
    sku,
    tier: tierOfSku(sku),
  });

  try {
    if (SUBSCRIPTION_SKUS.includes(sku as any)) {
      // For subscriptions we need the offerToken from the product details.
      // expo-iap requires an offerToken when offer details exist; we pull
      // it lazily here so the caller doesn't have to thread it through.
      const subs = await m.fetchProducts({ skus: [sku], type: 'subs' });
      const product = subs?.[0];
      const offer =
        product?.subscriptionOfferDetailsAndroid?.[0] ||
        product?.subscriptionOfferDetails?.[0];
      const offerToken = offer?.offerToken;

      await m.requestPurchase({
        type: 'subs',
        request: {
          google: {
            skus: [sku],
            ...(offerToken
              ? { subscriptionOffers: [{ sku, offerToken }] }
              : {}),
          },
        },
      });
    } else {
      // One-time product (lifetime)
      await m.requestPurchase({
        type: 'in-app',
        request: {
          google: { skus: [sku] },
        },
      });
    }
  } catch (err: any) {
    devLog('buyProduct threw', err);
    const code = err?.code;
    if (code !== 'E_USER_CANCELLED' && code !== 'user-cancelled') {
      usePurchasesStore.getState().setError(err?.message || 'Purchase failed');
    }
    usePurchasesStore.getState().setPurchasing(false);
  }
}

/**
 * Re-pull purchases from Google Play and update entitlement. Used by the
 * "Restore Purchases" button.
 */
export async function restorePurchases(): Promise<{ found: number }> {
  const m = loadIap();
  if (!m) return { found: 0 };

  usePurchasesStore.getState().setPurchasing(true);
  try {
    // expo-iap exposes a dedicated restorePurchases mutation that calls
    // the OS-native flow; fall back to refreshEntitlement if missing.
    if (typeof m.restorePurchases === 'function') {
      try { await m.restorePurchases(); } catch { /* ignore */ }
    }
    await refreshEntitlement();
    const tier = usePurchasesStore.getState().activeTier;
    track(ANALYTICS_EVENTS.PURCHASE_RESTORED, {
      tier,
      found: tier ? 1 : 0,
    });
    return { found: tier ? 1 : 0 };
  } finally {
    usePurchasesStore.getState().setPurchasing(false);
  }
}

/** Disconnect — call only on app unmount (rare). */
export function teardownPurchases(): void {
  try {
    purchaseUpdateSub?.remove?.();
    purchaseErrorSub?.remove?.();
    if (iap && connected) {
      iap.endConnection?.();
      connected = false;
    }
  } catch {
    // ignore
  }
}

/* -------------------------------------------------------------------------- */
/* Types + mock fallbacks                                                     */
/* -------------------------------------------------------------------------- */

export interface Offering {
  sku: string;
  tier: 'monthly' | 'annual' | 'lifetime';
  priceText: string;
  period: 'month' | 'year' | 'lifetime';
  trialDays: number;
  title: string;
}

const MOCK_OFFERINGS: Offering[] = [
  {
    sku: 'freeresume_premium_annual',
    tier: 'annual',
    priceText: '$19.99',
    period: 'year',
    trialDays: 7,
    title: 'FreeResume Pro (Annual)',
  },
  {
    sku: 'freeresume_premium_monthly',
    tier: 'monthly',
    priceText: '$2.99',
    period: 'month',
    trialDays: 3,
    title: 'FreeResume Pro (Monthly)',
  },
  {
    sku: 'freeresume_premium_lifetime',
    tier: 'lifetime',
    priceText: '$29.99',
    period: 'lifetime',
    trialDays: 0,
    title: 'FreeResume Pro (Lifetime)',
  },
];

function parseTrialDays(phases: any[] | undefined): number {
  if (!phases || phases.length < 2) return 0;
  const trial = phases[0];
  const isFree =
    trial?.priceAmountMicros === '0' ||
    trial?.priceAmountMicros === 0 ||
    trial?.price === '0' ||
    trial?.price === 0;
  if (!isFree) return 0;
  const period = trial?.billingPeriod || '';
  const match = period.match(/^P(\d+)([DWM])$/i);
  if (!match) return 0;
  const n = parseInt(match[1], 10);
  const unit = match[2].toUpperCase();
  if (unit === 'D') return n;
  if (unit === 'W') return n * 7;
  if (unit === 'M') return n * 30;
  return 0;
}
