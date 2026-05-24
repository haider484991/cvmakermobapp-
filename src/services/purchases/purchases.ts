/**
 * react-native-iap wrapper — talks directly to Google Play Billing.
 *
 * Design notes:
 *   - The actual `react-native-iap` import is lazy + try/catched so the
 *     module can be loaded in Expo Go (which lacks the native binding)
 *     without crashing.
 *   - Every public function is a safe no-op when the native module is
 *     unavailable. The UI just shows the paywall in a "preview" state.
 *   - All state changes go through `usePurchasesStore`, never local state.
 *   - We listen to the global purchase listener so the entitlement
 *     refreshes even if the user buys through Play Store directly.
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
let purchaseUpdateSub: any = null;
let purchaseErrorSub: any = null;

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
    iap = require('react-native-iap');
    return iap;
  } catch (err) {
    devLog('Native module unavailable', err);
    return null;
  }
}

/**
 * Idempotent — call once at app startup. Connects to Google Play and
 * starts the global purchase listener. After this returns, the store's
 * `activeTier` reflects what the user actually owns.
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

    // Listen for purchases the user makes any way — through our paywall,
    // through Play Store directly, or auto-renewals from a subscription.
    purchaseUpdateSub = m.purchaseUpdatedListener(async (purchase: any) => {
      devLog('purchaseUpdated', purchase?.productId);
      try {
        await handleSuccessfulPurchase(purchase);
      } catch (err) {
        devLog('purchaseUpdated handler failed', err);
      }
    });

    purchaseErrorSub = m.purchaseErrorListener((err: any) => {
      devLog('purchaseError', err?.code, err?.message);
      const code = err?.code;
      if (code === 'E_USER_CANCELLED') {
        usePurchasesStore.getState().setPurchasing(false);
        return;
      }
      usePurchasesStore.getState().setError(err?.message || 'Purchase failed');
      usePurchasesStore.getState().setPurchasing(false);
      track(ANALYTICS_EVENTS.PURCHASE_FAILED, {
        code: code || 'UNKNOWN',
        message: (err?.message || '').slice(0, 200),
      });
    });

    // Pull current entitlement on launch.
    await refreshEntitlement();
  } catch (err) {
    devLog('init failed', err);
    usePurchasesStore.getState().setInitialized(true);
  }
}

/**
 * Refresh entitlement from Google Play. Called on init and after every
 * purchase event. Safe to call frequently — Play caches the result.
 */
export async function refreshEntitlement(): Promise<void> {
  const m = loadIap();
  if (!m) return;

  try {
    const purchases: any[] = (await m.getAvailablePurchases()) || [];
    const owned = purchases.filter((p) => ALL_SKUS.includes(p.productId));

    if (owned.length === 0) {
      usePurchasesStore.getState().setEntitlement(null, null);
    } else {
      // Prefer lifetime > annual > monthly when the user has multiple.
      const priority = (sku: string) =>
        sku === 'freeresume_premium_lifetime' ? 3 :
        sku === 'freeresume_premium_annual' ? 2 : 1;
      const best = owned.sort((a, b) => priority(b.productId) - priority(a.productId))[0];
      const tier = tierOfSku(best.productId);
      usePurchasesStore.getState().setEntitlement(tier, best.productId);
    }

    usePurchasesStore.getState().markSynced();
    usePurchasesStore.getState().setInitialized(true);
  } catch (err) {
    devLog('refreshEntitlement failed', err);
    // Don't clear cached entitlement — keep the user as premium if they
    // were before. Play enforces expiry server-side.
    usePurchasesStore.getState().setInitialized(true);
  }
}

/**
 * Acknowledge + persist a fresh purchase. Required by Google within 3
 * days or the purchase auto-refunds.
 */
async function handleSuccessfulPurchase(purchase: any): Promise<void> {
  const m = loadIap();
  if (!m) return;

  const sku = purchase?.productId;
  const tier = tierOfSku(sku);

  // The acknowledge / consume API differs per type:
  //   - Subscription: acknowledgePurchaseAndroid (non-consumable)
  //   - One-time managed product (lifetime): same
  //   - One-time consumable: consumePurchaseAndroid (we don't use these)
  try {
    if (purchase.purchaseToken && !purchase.isAcknowledgedAndroid) {
      // finishTransaction handles both cases — preferred over manual ack
      await m.finishTransaction({ purchase, isConsumable: false });
    }
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
    purchase_token_prefix: (purchase.purchaseToken || '').slice(0, 8),
  });
}

/**
 * Fetch product details from Play for paywall display.
 * Returns price strings ("$2.99/month") localized to the user's currency.
 */
export async function getOfferings(): Promise<Offering[]> {
  const m = loadIap();
  if (!m) return MOCK_OFFERINGS;

  try {
    const [subs, oneTimes] = await Promise.all([
      m.getSubscriptions({ skus: SUBSCRIPTION_SKUS }).catch(() => []),
      m.getProducts({ skus: ONE_TIME_SKUS }).catch(() => []),
    ]);

    const offerings: Offering[] = [];

    for (const s of subs) {
      const tier = tierOfSku(s.productId);
      if (!tier) continue;
      const offer = s.subscriptionOfferDetails?.[0];
      const phase = offer?.pricingPhases?.pricingPhaseList?.[0];
      offerings.push({
        sku: s.productId,
        tier,
        priceText: phase?.formattedPrice || s.localizedPrice || '',
        period: tier === 'annual' ? 'year' : 'month',
        trialDays: parseTrialDays(offer?.pricingPhases?.pricingPhaseList),
        title: s.title || '',
      });
    }

    for (const p of oneTimes) {
      const tier = tierOfSku(p.productId);
      if (!tier) continue;
      offerings.push({
        sku: p.productId,
        tier,
        priceText: p.localizedPrice || '',
        period: 'lifetime',
        trialDays: 0,
        title: p.title || '',
      });
    }

    return offerings;
  } catch (err) {
    devLog('getOfferings failed', err);
    return MOCK_OFFERINGS;
  }
}

/**
 * Trigger the native purchase flow. Returns immediately — actual
 * fulfillment happens via the purchaseUpdatedListener.
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
      // Subscription requires offerToken on Android Billing v6+.
      const subs = await m.getSubscriptions({ skus: [sku] });
      const offer = subs?.[0]?.subscriptionOfferDetails?.[0];
      const offerToken = offer?.offerToken;
      await m.requestSubscription({
        sku,
        ...(offerToken
          ? { subscriptionOffers: [{ sku, offerToken }] }
          : {}),
      });
    } else {
      await m.requestPurchase({ sku });
    }
  } catch (err: any) {
    devLog('buyProduct threw', err);
    if (err?.code !== 'E_USER_CANCELLED') {
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
  priceText: string; // e.g. "$2.99"
  period: 'month' | 'year' | 'lifetime';
  trialDays: number;
  title: string;
}

/**
 * Mock offerings used when running in Expo Go or when the products
 * haven't been activated in Play Console yet. Lets the paywall UI
 * render and be tested without real billing.
 */
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
  // Subscription pricing phases: first phase with price=0 is the trial.
  // billingPeriod looks like "P7D" or "P1M". Extract the digit.
  if (!phases || phases.length < 2) return 0;
  const trialPhase = phases[0];
  if (trialPhase?.priceAmountMicros !== '0' && trialPhase?.priceAmountMicros !== 0) {
    return 0;
  }
  const period = trialPhase?.billingPeriod || '';
  const m = period.match(/^P(\d+)([DWM])$/i);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const unit = m[2].toUpperCase();
  if (unit === 'D') return n;
  if (unit === 'W') return n * 7;
  if (unit === 'M') return n * 30;
  return 0;
}
