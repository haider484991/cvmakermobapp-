/**
 * usePremium — one-liner check for "is this user premium right now?"
 *
 * Use anywhere you need to gate a feature:
 *
 *   const { isPremium, activeTier } = usePremium();
 *   if (template.isPremium && !isPremium) {
 *     showPaywall();
 *     return;
 *   }
 */

import { useEffect, useState } from 'react';
import { usePurchasesStore, selectIsPremium } from '@/stores/purchasesStore';
import { getOfferings, type Offering } from '@/services/purchases/purchases';

export function usePremium(): {
  isPremium: boolean;
  initialized: boolean;
  activeTier: 'monthly' | 'annual' | 'lifetime' | null;
  activeSku: string | null;
} {
  const isPremium = usePurchasesStore(selectIsPremium);
  const initialized = usePurchasesStore((s) => s.initialized);
  const activeTier = usePurchasesStore((s) => s.activeTier);
  const activeSku = usePurchasesStore((s) => s.activeSku);
  return { isPremium, initialized, activeTier, activeSku };
}

/**
 * Fetch + memoize the available offerings (prices, trial days, etc.) for
 * the paywall UI. Pulls from Google Play; falls back to mock prices when
 * native billing isn't available (Expo Go).
 */
export function useOfferings(): { offerings: Offering[]; loading: boolean } {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const o = await getOfferings();
        if (!cancelled) setOfferings(o);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { offerings, loading };
}

export default usePremium;
