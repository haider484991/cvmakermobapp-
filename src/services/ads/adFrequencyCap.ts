/**
 * Ad frequency cap manager.
 *
 * Enforces per-type cooldowns and a global cooldown so users never see two
 * ads back-to-back. AppOpen state is persisted across app launches via
 * AsyncStorage; everything else is in-memory.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AD_FREQUENCY } from './adConfig';

export type AdType = 'appOpen' | 'interstitial' | 'rewarded';

const STORAGE_KEY = '@ads/frequency-cap-v1';

interface PersistedState {
  lastAppOpenAt?: number;
  firstLaunchAt?: number;
}

let lastShownAt: Partial<Record<AdType, number>> = {};
let lastAnyAdAt = 0;
let persisted: PersistedState = {};
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      persisted = raw ? JSON.parse(raw) : {};
      if (!persisted.firstLaunchAt) {
        persisted.firstLaunchAt = Date.now();
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
      }
    } catch {
      persisted = { firstLaunchAt: Date.now() };
    }
    hydrated = true;
  })();
  return hydrationPromise;
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // best-effort; cap will reset next launch but no functional break
  }
}

export const adFrequencyCap = {
  ensureHydrated: hydrate,

  /**
   * Returns true if it's OK to show this ad type right now.
   * Always honor the global cooldown so we don't stack ads.
   */
  async canShow(type: AdType): Promise<boolean> {
    await hydrate();
    const now = Date.now();

    if (now - lastAnyAdAt < AD_FREQUENCY.globalCooldownMs) return false;

    if (type === 'appOpen') {
      if (
        AD_FREQUENCY.skipAppOpenOnFirstLaunch &&
        persisted.firstLaunchAt &&
        now - persisted.firstLaunchAt < 30 * 1000
      ) {
        return false;
      }
      const last = persisted.lastAppOpenAt ?? 0;
      return now - last >= AD_FREQUENCY.appOpenCooldownMs;
    }

    if (type === 'interstitial') {
      const last = lastShownAt.interstitial ?? 0;
      return now - last >= AD_FREQUENCY.interstitialCooldownMs;
    }

    // Rewarded ads are user-initiated and always allowed (subject to global cooldown).
    return true;
  },

  /**
   * Record that an ad of this type was shown. Updates per-type and global timers.
   */
  async markShown(type: AdType): Promise<void> {
    const now = Date.now();
    lastShownAt[type] = now;
    lastAnyAdAt = now;

    if (type === 'appOpen') {
      await hydrate();
      persisted.lastAppOpenAt = now;
      await persist();
    }
  },
};

export default adFrequencyCap;
