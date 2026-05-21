/**
 * Centralized AdMob configuration.
 *
 * IMPORTANT: When you add a new ad unit in the AdMob console, paste the
 * production ID here. In __DEV__ builds we always use Google's TestIds so
 * we never accidentally serve real ads to ourselves (which gets the AdMob
 * account banned).
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';

export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let TestIds: any = {};
try {
  if (!isExpoGo) {
    TestIds = require('react-native-google-mobile-ads').TestIds;
  }
} catch {
  // Native module unavailable (Expo Go); test IDs not needed.
}

export const AD_UNIT_IDS = {
  appOpen: __DEV__
    ? TestIds.APP_OPEN
    : 'ca-app-pub-6873688003145340/2371118599',
  rewarded: __DEV__
    ? TestIds.REWARDED
    : 'ca-app-pub-6873688003145340/5972479923',
  interstitial: __DEV__
    ? TestIds.INTERSTITIAL
    : 'ca-app-pub-6873688003145340/7165014070',
};

/**
 * Frequency caps. Tuned to maximize lifetime ad value without triggering
 * uninstalls. Times are milliseconds.
 */
export const AD_FREQUENCY = {
  /** App Open: at most once every 4 hours of wall-clock time. */
  appOpenCooldownMs: 4 * 60 * 60 * 1000,
  /** Interstitial: at most once every 60 seconds. */
  interstitialCooldownMs: 60 * 1000,
  /** Global: never show two ads within 30 seconds of each other. */
  globalCooldownMs: 30 * 1000,
  /** Skip App Open on the very first launch (let user reach the dashboard). */
  skipAppOpenOnFirstLaunch: true,
};

export const AD_REQUEST_OPTIONS = {
  requestNonPersonalizedAdsOnly: false, // overridden by UMP consent decision
  keywords: ['resume', 'cv', 'job', 'career', 'employment', 'hiring'],
};
