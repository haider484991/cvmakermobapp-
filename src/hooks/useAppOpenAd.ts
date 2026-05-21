/**
 * useAppOpenAd Hook
 *
 * Shows an App Open Ad on cold launch, gated by:
 *   - UMP consent + MobileAds initialization (adsInit.ready)
 *   - Frequency cap (max 1 every 4h, never on first launch)
 *
 * If anything fails, the user just sees the dashboard immediately — no
 * blocking, no UI changes.
 */

import { useEffect, useRef, useState } from 'react';
import { AD_REQUEST_OPTIONS, AD_UNIT_IDS, isExpoGo } from '@/services/ads/adConfig';
import { adFrequencyCap } from '@/services/ads/adFrequencyCap';
import { adsInit } from '@/services/ads/adsInit';

function devLog(...args: unknown[]) {
  if (__DEV__) console.log('[AppOpenAd]', ...args);
}

interface UseAppOpenAdReturn {
  hasShown: boolean;
  isLoading: boolean;
  error: Error | null;
}

export function useAppOpenAd(): UseAppOpenAdReturn {
  const [hasShown, setHasShown] = useState(false);
  const [isLoading, setIsLoading] = useState(!isExpoGo);
  const [error, setError] = useState<Error | null>(null);
  const hasAttemptedRef = useRef(false);

  useEffect(() => {
    if (isExpoGo || hasAttemptedRef.current) {
      setIsLoading(false);
      return;
    }
    hasAttemptedRef.current = true;

    let cancelled = false;
    let unsubscribers: Array<() => void> = [];

    (async () => {
      const ready = await adsInit.ready();
      if (!ready || cancelled) {
        setIsLoading(false);
        return;
      }

      const allowed = await adFrequencyCap.canShow('appOpen');
      if (!allowed || cancelled) {
        devLog('Capped or first-launch skip');
        setIsLoading(false);
        return;
      }

      let mod: any;
      try {
        mod = require('react-native-google-mobile-ads');
      } catch (err) {
        devLog('Module unavailable', err);
        setIsLoading(false);
        return;
      }

      const { AppOpenAd, AdEventType } = mod;
      const ad = AppOpenAd.createForAdRequest(
        AD_UNIT_IDS.appOpen,
        AD_REQUEST_OPTIONS,
      );

      const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
        if (cancelled) return;
        setIsLoading(false);
        try {
          ad.show();
        } catch (err) {
          devLog('Show failed', err);
          setError(err as Error);
        }
      });

      const unsubOpened = ad.addAdEventListener(AdEventType.OPENED, () => {
        adFrequencyCap.markShown('appOpen');
        setHasShown(true);
      });

      const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        setHasShown(true);
      });

      const unsubError = ad.addAdEventListener(AdEventType.ERROR, (err: any) => {
        devLog('Load error', err?.message);
        setError(new Error(err?.message ?? 'Failed to load App Open Ad'));
        setIsLoading(false);
      });

      unsubscribers = [unsubLoaded, unsubOpened, unsubClosed, unsubError];

      try {
        ad.load();
      } catch (err) {
        devLog('Load threw', err);
        setError(err as Error);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribers.forEach((u) => u());
    };
  }, []);

  return { hasShown, isLoading, error };
}

export default useAppOpenAd;
