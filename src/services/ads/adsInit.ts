/**
 * Single source of truth for "are ads ready to be requested?".
 *
 * Lifecycle:
 *   1. Gather UMP consent (GDPR / EEA / regulated US states).
 *   2. Once consent permits ads (canRequestAds === true), initialize the
 *      Mobile Ads SDK with brand-safe content rating and child-safety flags.
 *   3. Resolve `ready()` so callers (preloaders, hooks) can start loading.
 *
 * If anything fails (Expo Go, native module missing, network error during
 * consent), we degrade gracefully: ads simply won't show, but the app keeps
 * working.
 */

import { isExpoGo } from './adConfig';

let readyPromise: Promise<boolean> | null = null;
let canRequest = false;

function devLog(...args: unknown[]) {
  if (__DEV__) console.log('[Ads]', ...args);
}

async function gatherConsentAndInit(): Promise<boolean> {
  if (isExpoGo) {
    devLog('Expo Go detected, ads disabled');
    return false;
  }

  let mobileAdsModule: any;
  try {
    mobileAdsModule = require('react-native-google-mobile-ads');
  } catch (err) {
    devLog('Native ads module not available', err);
    return false;
  }

  const { AdsConsent, default: MobileAds, MaxAdContentRating } =
    mobileAdsModule;

  // 1. UMP consent — required by Google policy for EEA / UK / Swiss / regulated US.
  try {
    const info = await AdsConsent.gatherConsent();
    devLog('Consent gathered', {
      status: info?.status,
      canRequestAds: info?.canRequestAds,
    });
    if (info && info.canRequestAds === false) {
      // User explicitly refused consent and is in a regulated region.
      // We could still serve non-personalized ads if Google permits, but
      // gatherConsent already accounts for that — if it says no, we honor it.
      return false;
    }
  } catch (err) {
    // Consent flow failed (often: airplane mode, blocked endpoints).
    // Per Google guidance, fall back to requesting non-personalized ads
    // rather than blocking ads entirely.
    devLog('Consent gather failed, continuing with NPA', err);
  }

  // 2. Initialize the SDK.
  try {
    await MobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.T,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    await MobileAds().initialize();
    devLog('MobileAds initialized');
    canRequest = true;
    return true;
  } catch (err) {
    devLog('MobileAds initialization failed', err);
    return false;
  }
}

export const adsInit = {
  /**
   * Idempotent: first caller starts the init, subsequent callers await the
   * same promise. Returns true once ads can be requested.
   */
  ready(): Promise<boolean> {
    if (!readyPromise) {
      readyPromise = gatherConsentAndInit();
    }
    return readyPromise;
  },

  /**
   * Synchronous check: cheap to call from event handlers that already
   * awaited `ready()` once during app startup.
   */
  canRequestAds(): boolean {
    return canRequest;
  },
};

export default adsInit;
