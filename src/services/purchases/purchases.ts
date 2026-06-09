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

// SYNCHRONOUS guard against double-purchase. The store's isPurchasing flag
// updates asynchronously, so two rapid taps can both pass a store-based
// check before the first re-render — each firing a separate requestPurchase
// and creating a separate order (the "7 charges from one tap" bug). This
// module-level boolean flips synchronously, so the second call is rejected
// immediately, before any await.
let purchaseInFlight = false;

// Promise that resolves once initPurchases() finishes (success OR failure).
// getOfferings/buyProduct await this so they never fire fetchProducts
// before the billing connection is established.
let initPromise: Promise<void> | null = null;
let initOutcome: 'pending' | 'ok' | 'failed' = 'pending';

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
  } catch (err: any) {
    devLog('Native module unavailable', err);
    // CRITICAL diagnostic: surface the silent loadIap failure to analytics
    // so we can tell apart "Expo Go" from "AAB has broken native binding".
    track('purchases_loadiap_failed' as any, {
      message: (err?.message || String(err)).slice(0, 300),
      name: err?.name,
    });
    return null;
  }
}

/** Reject if `p` doesn't settle within `ms` milliseconds. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

/**
 * Idempotent. Connects to Google Play and starts the global purchase
 * listener. After this returns, the store's `activeTier` reflects what
 * the user actually owns.
 *
 * v1.8.3 diagnostics: every branch now fires an analytics event so we can
 * see exactly where init dies. initConnection is wrapped in a 15s timeout
 * so hangs surface as a `purchases_init_timeout` event instead of silently
 * never resolving.
 */
export async function initPurchases(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const m = loadIap();
    if (!m) {
      // Track this branch explicitly — without this event we can't tell
      // "Expo Go" from "AAB has broken native binding" from analytics.
      track('purchases_init_skipped' as any, {
        reason: isExpoGo ? 'expo_go' : 'native_module_unavailable',
      });
      initOutcome = 'failed';
      usePurchasesStore.getState().setInitialized(true);
      return;
    }

    // Surface the module shape so we can confirm initConnection exists
    // and is callable from the JS bridge.
    track('purchases_init_module_shape' as any, {
      has_initConnection: typeof m.initConnection === 'function',
      has_fetchProducts: typeof m.fetchProducts === 'function',
      has_requestPurchase: typeof m.requestPurchase === 'function',
      has_purchaseUpdatedListener: typeof m.purchaseUpdatedListener === 'function',
    });

    try {
      if (!connected) {
        track('purchases_init_connect_start' as any, {});
        // 15s timeout — if the native binding is broken, initConnection
        // hangs forever rather than rejecting. Force a rejection so we
        // can see it in analytics.
        await withTimeout(m.initConnection(), 15_000, 'initConnection');
        connected = true;
        track('purchases_init_connect_done' as any, {});
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
      initOutcome = 'ok';
      // Successful init — log so we can confirm in analytics
      track('purchases_init_success' as any, {
        iap_available: true,
      });
    } catch (err: any) {
      devLog('init failed', err);
      initOutcome = 'failed';
      const isTimeout = String(err?.message || '').includes('timed out');
      // CRITICAL: surface init failures to analytics so we can diagnose
      // "instant failed to query product" errors that are actually init
      // failures masquerading as query failures.
      track((isTimeout ? 'purchases_init_timeout' : 'purchases_init_failed') as any, {
        code: err?.code || 'UNKNOWN',
        message: (err?.message || String(err)).slice(0, 300),
        name: err?.name,
        stage: connected ? 'after_connect' : 'before_connect',
      });
      usePurchasesStore.getState().setInitialized(true);
    }
  })();
  return initPromise;
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

/** Fetch product details for the paywall UI.
 *
 * v1.8.3 policy fix: never returns USD MOCK_OFFERINGS in production. If
 * Play Billing isn't available (Expo Go) we return mocks ONLY in __DEV__
 * so designers can still preview the layout. In a real production build,
 * a fetch failure returns [] — the paywall then shows a "prices
 * unavailable" state instead of fake USD numbers that mismatch the
 * native Play checkout sheet's localized currency. (Subscriptions policy
 * violation 2026-05-27.)
 */
export async function getOfferings(): Promise<Offering[]> {
  const m = loadIap();
  if (!m) return __DEV__ ? MOCK_OFFERINGS : [];

  // CRITICAL: wait for initPurchases to settle before fetching. Without
  // this, opening the paywall during cold-launch fires fetchProducts
  // before initConnection() resolves, which silently returns empty and
  // we end up showing mocks forever.
  try {
    if (initPromise) {
      await withTimeout(initPromise, 20_000, 'init_await_in_getOfferings');
    }
  } catch (err: any) {
    track('paywall_init_await_failed' as any, {
      message: (err?.message || String(err)).slice(0, 200),
    });
    // Still try to fetch — maybe init succeeded but tracking lagged.
  }

  if (initOutcome !== 'ok') {
    // We're going to fetch anyway, but log that we're doing so without
    // a confirmed-good init. This makes "no init event + empty offerings"
    // distinguishable from "init succeeded but Play returned nothing".
    track('paywall_fetch_without_init' as any, {
      outcome: initOutcome,
    });
  }

  try {
    // v1.9.2: capture the FULL native error on fetch failure. The
    // BillingClient responseCode is the smoking gun that tells us WHY a
    // specific account fails while others succeed:
    //   3 = BILLING_UNAVAILABLE (account country/Play version not set up)
    //   4 = ITEM_UNAVAILABLE   (product not available for this account)
    //   5 = DEVELOPER_ERROR    (app/package/signing misconfigured)
    //   6 = ERROR              (generic, often transient)
    const captureFetchError = (event: string) => (e: any) => {
      track(event as any, {
        message: (e?.message || String(e)).slice(0, 200),
        code: e?.code,
        responseCode: e?.responseCode ?? e?.userInfo?.responseCode,
        debugMessage: (e?.debugMessage || e?.userInfo?.debugMessage || '').slice(0, 200),
        userInfo: JSON.stringify(e?.userInfo || {}).slice(0, 200),
      });
      return [];
    };
    const [subs, oneTimes] = await Promise.all([
      m.fetchProducts({ skus: SUBSCRIPTION_SKUS, type: 'subs' }).catch(captureFetchError('paywall_fetch_subs_threw')),
      m.fetchProducts({ skus: ONE_TIME_SKUS, type: 'in-app' }).catch(captureFetchError('paywall_fetch_onetime_threw')),
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

    // v1.8.3 policy fix: prod returns [] on empty so the paywall renders
    // a "prices unavailable" state instead of fake USD numbers. Dev/Expo
    // Go preview still gets mocks so designers can iterate on layout.
    if (offerings.length > 0) return offerings;
    return __DEV__ ? MOCK_OFFERINGS : [];
  } catch (err: any) {
    devLog('getOfferings failed', err);
    // Surface the actual native error so we can diagnose remotely.
    track('paywall_offerings_failed' as any, {
      code: err?.code || 'UNKNOWN',
      message: (err?.message || String(err)).slice(0, 300),
      name: err?.name,
    });
    return __DEV__ ? MOCK_OFFERINGS : [];
  }
}

/**
 * Open the native purchase flow. Returns immediately — actual fulfillment
 * happens via the purchaseUpdatedListener registered in initPurchases().
 */
export async function buyProduct(sku: string): Promise<void> {
  // HARD synchronous guard — reject a second purchase before any await so
  // rapid taps / re-invocations can't each create an order.
  if (purchaseInFlight) {
    devLog('buyProduct ignored — a purchase is already in flight');
    return;
  }

  const m = loadIap();
  if (!m) {
    usePurchasesStore
      .getState()
      .setError('In-app purchases unavailable in Expo Go. Use a dev/production build.');
    return;
  }

  purchaseInFlight = true;
  usePurchasesStore.getState().setPurchasing(true);
  usePurchasesStore.getState().setError(null);

  track(ANALYTICS_EVENTS.PURCHASE_INITIATED, {
    sku,
    tier: tierOfSku(sku),
  });

  try {
    // Don't let the user buy something they already own. Re-purchasing a
    // subscription/lifetime creates a duplicate order; if they already own
    // it, just restore the entitlement and bail.
    try {
      const existing: any[] = (await m.getAvailablePurchases()) || [];
      const owns = existing.some((p) => {
        const owned = p.productId || p.id || (p.productIds && p.productIds[0]);
        return owned === sku;
      });
      if (owns) {
        devLog('already owns', sku, '— restoring instead of buying again');
        await refreshEntitlement();
        usePurchasesStore.getState().setError(null);
        return; // finally{} clears the flags
      }
    } catch {
      // If the ownership check fails, proceed with purchase (best-effort).
    }

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
  } finally {
    // Clear the in-flight guard. The purchaseUpdatedListener will set the
    // final entitlement state; this just re-enables the buy button once the
    // native flow has been handed off (or errored/cancelled).
    purchaseInFlight = false;
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
