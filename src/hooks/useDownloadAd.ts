/**
 * useDownloadAd Hook
 *
 * Manages Google AdMob Rewarded Ads for the resume download feature.
 * Users watch an ad before downloading their resume.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// Types for type safety
type RewardedAdType = {
  load: () => void;
  show: () => void;
  addAdEventListener: (event: string, handler: (data?: any) => void) => () => void;
};

// Ad Unit IDs
const PRODUCTION_AD_UNIT_ID = 'ca-app-pub-6873688003145340/5972479923';

// Check if running in Expo Go
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Safe lazy loading of AdMob
let RewardedAd: any;
let RewardedAdEventType: any;
let AdEventType: any;
let TestIds: any;

// Mock implementation for Expo Go
const MockRewardedAd = {
  createForAdRequest: (adUnitId: string, options?: any) => {
    return {
      load: function () {
        console.log('[MockAd] Loading ad...');
        // Simulate load delay
        setTimeout(() => {
          this.callbacks['loaded']?.();
        }, 1000);
      },
      show: function () {
        console.log('[MockAd] Showing ad...');
        // Simulate watch delay and reward
        setTimeout(() => {
          this.callbacks['earned_reward']?.({ type: 'simulated', amount: 1 });
          this.callbacks['closed']?.();
        }, 2000);
      },
      addAdEventListener: function (event: string, handler: any) {
        this.callbacks[event] = handler;
        return () => { delete this.callbacks[event]; };
      },
      callbacks: {} as Record<string, any>
    };
  }
};

let rewardedAd: any;

try {
  if (!isExpoGo) {
    const mobileAds = require('react-native-google-mobile-ads');
    RewardedAd = mobileAds.RewardedAd;
    RewardedAdEventType = mobileAds.RewardedAdEventType;
    AdEventType = mobileAds.AdEventType;
    TestIds = mobileAds.TestIds;

    const adUnitId = __DEV__ ? TestIds.REWARDED : PRODUCTION_AD_UNIT_ID;
    rewardedAd = RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
      keywords: ['resume', 'job', 'career', 'employment'],
    });
  } else {
    throw new Error('Expo Go detected');
  }
} catch (error) {
  console.log('[useDownloadAd] AdMob native module not available, using mock');

  // Define constants for mock
  RewardedAdEventType = {
    LOADED: 'loaded',
    EARNED_REWARD: 'earned_reward',
  };
  AdEventType = {
    CLOSED: 'closed',
    ERROR: 'error',
  };

  // Create mock instance
  rewardedAd = MockRewardedAd.createForAdRequest('mock-id');
}

interface UseDownloadAdReturn {
  /** Whether the ad is loaded and ready to show */
  loaded: boolean;
  /** Whether the ad is currently loading */
  loading: boolean;
  /** Any error that occurred while loading the ad */
  error: Error | null;
  /** Show the rewarded ad. Returns a promise that resolves when the user earns the reward */
  showAd: () => Promise<boolean>;
  /** Manually reload the ad */
  reloadAd: () => void;
}

export function useDownloadAd(): UseDownloadAdReturn {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Use ref to track reward callback
  const rewardCallbackRef = useRef<((earned: boolean) => void) | null>(null);

  // Load the ad
  const loadAd = useCallback(() => {
    setLoading(true);
    setError(null);

    try {
      rewardedAd.load();
    } catch (err) {
      console.error('[useDownloadAd] Failed to start loading ad:', err);
      setError(err as Error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Event listener for when ad is loaded
    const unsubscribeLoaded = rewardedAd.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => {
        console.log('[useDownloadAd] Ad loaded successfully');
        setLoaded(true);
        setLoading(false);
        setError(null);
      }
    );

    // Event listener for when user earns reward
    const unsubscribeEarnedReward = rewardedAd.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      (reward: any) => {
        console.log('[useDownloadAd] User earned reward:', reward);
        console.log(`[useDownloadAd] Reward type: ${reward.type}, amount: ${reward.amount}`);

        // Resolve the promise with success
        if (rewardCallbackRef.current) {
          rewardCallbackRef.current(true);
          rewardCallbackRef.current = null;
        }
      }
    );

    // Event listener for ad closed (without earning reward)
    const unsubscribeClosed = rewardedAd.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        console.log('[useDownloadAd] Ad closed');
        setLoaded(false);

        // If callback still exists, user closed without earning reward
        if (rewardCallbackRef.current) {
          rewardCallbackRef.current(false);
          rewardCallbackRef.current = null;
        }

        // Pre-load the next ad
        loadAd();
      }
    );

    // Event listener for ad errors
    const unsubscribeError = rewardedAd.addAdEventListener(
      AdEventType.ERROR,
      (err: any) => {
        console.error('[useDownloadAd] Ad error:', err);
        setError(new Error(err.message || 'Failed to load ad'));
        setLoading(false);
        setLoaded(false);
      }
    );

    // Start loading the ad immediately
    loadAd();

    // Cleanup listeners on unmount
    return () => {
      unsubscribeLoaded();
      unsubscribeEarnedReward();
      unsubscribeClosed();
      unsubscribeError();
    };
  }, [loadAd]);

  // Show the ad and return a promise
  const showAd = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!loaded) {
        console.log('[useDownloadAd] Ad not loaded, cannot show');
        resolve(false);
        return;
      }

      // Store the callback
      rewardCallbackRef.current = resolve;

      try {
        rewardedAd.show();
      } catch (err) {
        console.error('[useDownloadAd] Failed to show ad:', err);
        rewardCallbackRef.current = null;
        resolve(false);
      }
    });
  }, [loaded]);

  // Manual reload function
  const reloadAd = useCallback(() => {
    if (!loading && !loaded) {
      loadAd();
    }
  }, [loading, loaded, loadAd]);

  return {
    loaded,
    loading,
    error,
    showAd,
    reloadAd,
  };
}

export default useDownloadAd;
