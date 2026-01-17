/**
 * useDownloadAd Hook
 *
 * Manages Google AdMob Rewarded Ads for the resume download feature.
 * Uses the preloaded ad service for faster ad availability.
 */

import { useEffect, useState, useCallback } from 'react';
import { adPreloader } from '@/services/ads';

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
  const [loaded, setLoaded] = useState(adPreloader.isReady());
  const [loading, setLoading] = useState(adPreloader.isCurrentlyLoading());
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Subscribe to preloader state changes
    const unsubscribe = adPreloader.subscribe((isLoaded) => {
      setLoaded(isLoaded);
      setLoading(adPreloader.isCurrentlyLoading());
      if (!isLoaded && !adPreloader.isCurrentlyLoading()) {
        // Ad failed to load after all retries
        setError(new Error('Failed to load ad'));
      } else {
        setError(null);
      }
    });

    // Ensure preloader is loading if not ready
    if (!adPreloader.isReady() && !adPreloader.isCurrentlyLoading()) {
      adPreloader.preload();
    }

    return () => unsubscribe();
  }, []);

  // Show the ad using preloader
  const showAd = useCallback(async (): Promise<boolean> => {
    if (!loaded) {
      console.log('[useDownloadAd] Ad not loaded, cannot show');
      return false;
    }

    try {
      return await adPreloader.showAd();
    } catch (err) {
      console.error('[useDownloadAd] Failed to show ad:', err);
      return false;
    }
  }, [loaded]);

  // Manual reload function
  const reloadAd = useCallback(() => {
    if (!loading && !loaded) {
      adPreloader.preload();
    }
  }, [loading, loaded]);

  return {
    loaded,
    loading,
    error,
    showAd,
    reloadAd,
  };
}

export default useDownloadAd;
