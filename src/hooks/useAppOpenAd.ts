/**
 * useAppOpenAd Hook
 *
 * Displays an App Open Ad when the app launches.
 * This ad is shown once when the app first opens.
 */

import { useEffect, useRef, useState } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// Check if running in Expo Go
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Ad Unit IDs
const PRODUCTION_AD_UNIT_ID = 'ca-app-pub-6873688003145340/2371118599';

// Safe lazy loading of AdMob
let AppOpenAd: any;
let AdEventType: any;
let TestIds: any;
let isAdMobAvailable = false;

try {
  if (!isExpoGo) {
    const mobileAds = require('react-native-google-mobile-ads');
    AppOpenAd = mobileAds.AppOpenAd;
    AdEventType = mobileAds.AdEventType;
    TestIds = mobileAds.TestIds;
    isAdMobAvailable = true;
  }
} catch (error) {
  console.log('[useAppOpenAd] AdMob native module not available, ads will not be shown');
}

// Use test ads in development to prevent account bans
const adUnitId = isAdMobAvailable && TestIds ? (__DEV__ ? TestIds.APP_OPEN : PRODUCTION_AD_UNIT_ID) : '';

interface UseAppOpenAdReturn {
  /** Whether the ad has been shown */
  hasShown: boolean;
  /** Whether the ad is currently loading */
  isLoading: boolean;
  /** Any error that occurred */
  error: Error | null;
}

export function useAppOpenAd(): UseAppOpenAdReturn {
  const [hasShown, setHasShown] = useState(false);
  const [isLoading, setIsLoading] = useState(!isAdMobAvailable ? false : true);
  const [error, setError] = useState<Error | null>(null);

  // Ref to track if we've already attempted to show the ad
  const hasAttemptedRef = useRef(false);
  // Ref to hold the ad instance
  const appOpenAdRef = useRef<any>(null);

  useEffect(() => {
    // If AdMob is not available, skip ad loading
    if (!isAdMobAvailable) {
      console.log('[useAppOpenAd] AdMob not available, skipping ad');
      return;
    }

    // Only attempt once per app session
    if (hasAttemptedRef.current) {
      return;
    }
    hasAttemptedRef.current = true;

    console.log('[useAppOpenAd] Initializing App Open Ad');

    // Create the App Open Ad instance
    const appOpenAd = AppOpenAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });
    appOpenAdRef.current = appOpenAd;

    // Event listener for when ad is loaded
    const unsubscribeLoaded = appOpenAd.addAdEventListener(
      AdEventType.LOADED,
      () => {
        console.log('[useAppOpenAd] Ad loaded successfully, showing immediately');
        setIsLoading(false);

        // Show the ad immediately when loaded
        try {
          appOpenAd.show();
        } catch (err) {
          console.error('[useAppOpenAd] Failed to show ad:', err);
          setError(err as Error);
        }
      }
    );

    // Event listener for when ad is closed
    const unsubscribeClosed = appOpenAd.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        console.log('[useAppOpenAd] Ad closed');
        setHasShown(true);
      }
    );

    // Event listener for when ad is opened (shown)
    const unsubscribeOpened = appOpenAd.addAdEventListener(
      AdEventType.OPENED,
      () => {
        console.log('[useAppOpenAd] Ad opened/shown');
        setHasShown(true);
      }
    );

    // Event listener for ad errors
    const unsubscribeError = appOpenAd.addAdEventListener(
      AdEventType.ERROR,
      (err: any) => {
        console.error('[useAppOpenAd] Ad error:', err);
        setError(new Error(err?.message || 'Failed to load App Open Ad'));
        setIsLoading(false);
      }
    );

    // Start loading the ad
    console.log('[useAppOpenAd] Loading ad...');
    try {
      appOpenAd.load();
    } catch (err) {
      console.error('[useAppOpenAd] Failed to start loading:', err);
      setError(err as Error);
      setIsLoading(false);
    }

    // Cleanup listeners on unmount
    return () => {
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeOpened();
      unsubscribeError();
    };
  }, []);

  return {
    hasShown,
    isLoading,
    error,
  };
}

export default useAppOpenAd;
