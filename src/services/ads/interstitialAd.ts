/**
 * Interstitial ad manager.
 *
 * Preloads the next interstitial as soon as the previous one closes so the
 * ad is always warm when a fire point hits. Frequency-capped via
 * `adFrequencyCap` so we never spam the user.
 */

import { AD_REQUEST_OPTIONS, AD_UNIT_IDS, isExpoGo } from './adConfig';
import { adFrequencyCap } from './adFrequencyCap';
import { adsInit } from './adsInit';

function devLog(...args: unknown[]) {
  if (__DEV__) console.log('[InterstitialAd]', ...args);
}

class InterstitialAdService {
  private InterstitialAd: any = null;
  private AdEventType: any = null;
  private ad: any = null;
  private isLoaded = false;
  private isLoading = false;
  private isShowing = false;
  private retryDelay = 3000;

  async preload(): Promise<void> {
    if (isExpoGo || this.isShowing) return;
    if (this.isLoaded || this.isLoading) return;

    const ready = await adsInit.ready();
    if (!ready) return;

    if (!this.InterstitialAd) {
      try {
        const m = require('react-native-google-mobile-ads');
        this.InterstitialAd = m.InterstitialAd;
        this.AdEventType = m.AdEventType;
      } catch (err) {
        devLog('Native module unavailable', err);
        return;
      }
    }

    this.isLoading = true;

    try {
      this.ad = this.InterstitialAd.createForAdRequest(
        AD_UNIT_IDS.interstitial,
        AD_REQUEST_OPTIONS,
      );

      const unsubLoaded = this.ad.addAdEventListener(
        this.AdEventType.LOADED,
        () => {
          devLog('Loaded');
          this.isLoaded = true;
          this.isLoading = false;
          this.retryDelay = 3000;
        },
      );

      const unsubError = this.ad.addAdEventListener(
        this.AdEventType.ERROR,
        (err: any) => {
          devLog('Load error', err?.message);
          this.isLoaded = false;
          this.isLoading = false;
          unsubLoaded();
          unsubError();
          // Exponential backoff up to 30s
          const delay = Math.min(this.retryDelay, 30_000);
          this.retryDelay = Math.min(this.retryDelay * 2, 30_000);
          setTimeout(() => this.preload(), delay);
        },
      );

      const unsubClosed = this.ad.addAdEventListener(
        this.AdEventType.CLOSED,
        () => {
          devLog('Closed, preloading next');
          this.isLoaded = false;
          this.isShowing = false;
          unsubLoaded();
          unsubError();
          unsubClosed();
          // Preload next one a moment later.
          setTimeout(() => this.preload(), 500);
        },
      );

      this.ad.load();
    } catch (err) {
      devLog('Preload threw', err);
      this.isLoading = false;
    }
  }

  /**
   * Try to show the interstitial. Respects frequency cap. Returns true if
   * the ad was shown, false otherwise (no-op if not loaded or capped).
   */
  async tryShow(): Promise<boolean> {
    if (isExpoGo || !this.ad || !this.isLoaded || this.isShowing) {
      return false;
    }

    const allowed = await adFrequencyCap.canShow('interstitial');
    if (!allowed) {
      devLog('Capped, skipping');
      return false;
    }

    try {
      this.isShowing = true;
      await this.ad.show();
      await adFrequencyCap.markShown('interstitial');
      return true;
    } catch (err) {
      devLog('Show failed', err);
      this.isShowing = false;
      return false;
    }
  }

  isReady(): boolean {
    return this.isLoaded;
  }
}

export const interstitialAd = new InterstitialAdService();
export default interstitialAd;
