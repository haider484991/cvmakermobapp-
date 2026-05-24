/**
 * Purchases store — single source of truth for "is this user premium?"
 *
 * Entitlement is derived from owned purchases. We persist a snapshot to
 * AsyncStorage so app launch is instant (no network wait), then refresh
 * from Google Play in the background. If the network fails, the cached
 * snapshot remains authoritative until next successful refresh — Google
 * Play itself enforces subscription expiry server-side anyway.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ProductTier } from '@/services/purchases/productIds';

interface PurchasesState {
  /** Has the entitlement been loaded at least once this app session? */
  initialized: boolean;
  /** Resolved entitlement: free user → null, premium → which tier they paid */
  activeTier: ProductTier | null;
  /** Sku of the currently-owned purchase, used for "Manage subscription" */
  activeSku: string | null;
  /** Timestamp of last successful refresh from Google Play (ms) */
  lastSyncAt: number | null;
  /** True while a purchase or restore is in-flight (for spinners) */
  isPurchasing: boolean;
  /** Last error from the IAP layer (for UI display) */
  lastError: string | null;

  // Mutators
  setEntitlement: (tier: ProductTier | null, sku: string | null) => void;
  setInitialized: (v: boolean) => void;
  setPurchasing: (v: boolean) => void;
  setError: (msg: string | null) => void;
  markSynced: () => void;
}

export const usePurchasesStore = create<PurchasesState>()(
  persist(
    (set) => ({
      initialized: false,
      activeTier: null,
      activeSku: null,
      lastSyncAt: null,
      isPurchasing: false,
      lastError: null,

      setEntitlement: (activeTier, activeSku) =>
        set({ activeTier, activeSku, initialized: true }),
      setInitialized: (initialized) => set({ initialized }),
      setPurchasing: (isPurchasing) => set({ isPurchasing }),
      setError: (lastError) => set({ lastError }),
      markSynced: () => set({ lastSyncAt: Date.now() }),
    }),
    {
      name: '@purchases/state-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Don't persist transient state — only the entitlement itself.
      partialize: (s) => ({
        activeTier: s.activeTier,
        activeSku: s.activeSku,
        lastSyncAt: s.lastSyncAt,
      }),
    },
  ),
);

/** Convenience selector — true iff the user is premium right now. */
export function selectIsPremium(state: PurchasesState): boolean {
  return state.activeTier !== null;
}
