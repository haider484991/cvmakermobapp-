/**
 * Rewarded ad preloader.
 *
 * Keeps a rewarded ad warm so the user never waits when they tap Download.
 * Uses centralized config + UMP gating + frequency cap.
 */

import { AD_REQUEST_OPTIONS, AD_UNIT_IDS, isExpoGo } from './adConfig';
import { adFrequencyCap } from './adFrequencyCap';
import { adsInit } from './adsInit';

function devLog(...args: unknown[]) {
  if (__DEV__) console.log('[AdPreloader]', ...args);
}

class AdPreloaderService {
  private rewardedAd: any = null;
  private isLoaded = false;
  private isLoading = false;
  private loadAttempts = 0;
  private maxAttempts = 5;
  private listeners: Set<(loaded: boolean) => void> = new Set();
  private RewardedAd: any = null;
  private RewardedAdEventType: any = null;
  private AdEventType: any = null;
  private unsubscribers: (() => void)[] = [];

  private async ensureModuleLoaded(): Promise<boolean> {
    if (this.RewardedAd) return true;
    if (isExpoGo) return false;

    const ready = await adsInit.ready();
    if (!ready) return false;

    try {
      const m = require('react-native-google-mobile-ads');
      this.RewardedAd = m.RewardedAd;
      this.RewardedAdEventType = m.RewardedAdEventType;
      this.AdEventType = m.AdEventType;
      this.createAdInstance();
      return true;
    } catch (err) {
      devLog('Module unavailable', err);
      return false;
    }
  }

  private createAdInstance() {
    if (!this.RewardedAd) return;
    this.rewardedAd = this.RewardedAd.createForAdRequest(
      AD_UNIT_IDS.rewarded,
      AD_REQUEST_OPTIONS,
    );
    this.setupListeners();
  }

  private setupListeners() {
    if (!this.rewardedAd) return;

    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];

    const unsubLoaded = this.rewardedAd.addAdEventListener(
      this.RewardedAdEventType.LOADED,
      () => {
        devLog('Loaded');
        this.isLoaded = true;
        this.isLoading = false;
        this.loadAttempts = 0;
        this.notifyListeners(true);
      },
    );

    const unsubError = this.rewardedAd.addAdEventListener(
      this.AdEventType.ERROR,
      (err: any) => {
        devLog('Load error', err?.message);
        this.isLoaded = false;
        this.isLoading = false;

        if (this.loadAttempts < this.maxAttempts) {
          const delay = Math.min(3000 * Math.pow(2, this.loadAttempts), 30_000);
          setTimeout(() => this.preload(), delay);
        } else {
          this.notifyListeners(false);
        }
      },
    );

    const unsubClosed = this.rewardedAd.addAdEventListener(
      this.AdEventType.CLOSED,
      () => {
        this.isLoaded = false;
        this.loadAttempts = 0;
        setTimeout(() => this.preload(), 1000);
      },
    );

    this.unsubscribers.push(unsubLoaded, unsubError, unsubClosed);
  }

  async preload(): Promise<void> {
    const ok = await this.ensureModuleLoaded();
    if (!ok || !this.rewardedAd) return;

    if (this.isLoaded || this.isLoading) return;

    this.isLoading = true;
    this.loadAttempts++;

    try {
      this.rewardedAd.load();
    } catch (err) {
      devLog('Preload threw', err);
      this.isLoading = false;
    }
  }

  isReady(): boolean {
    return this.isLoaded;
  }

  isCurrentlyLoading(): boolean {
    return this.isLoading;
  }

  getAd(): any {
    return this.rewardedAd;
  }

  subscribe(callback: (loaded: boolean) => void): () => void {
    this.listeners.add(callback);
    callback(this.isLoaded);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(loaded: boolean) {
    this.listeners.forEach((cb) => cb(loaded));
  }

  async showAd(): Promise<boolean> {
    if (!this.isLoaded || !this.rewardedAd) return false;

    return new Promise((resolve) => {
      let resolved = false;
      let earned = false;

      const unsubReward = this.rewardedAd.addAdEventListener(
        this.RewardedAdEventType.EARNED_REWARD,
        () => {
          earned = true;
        },
      );

      const unsubClosed = this.rewardedAd.addAdEventListener(
        this.AdEventType.CLOSED,
        () => {
          unsubReward();
          unsubClosed();
          this.isLoaded = false;
          adFrequencyCap.markShown('rewarded');
          if (!resolved) {
            resolved = true;
            resolve(earned);
          }
          setTimeout(() => this.preload(), 500);
        },
      );

      try {
        this.rewardedAd.show();
      } catch (err) {
        devLog('Show error', err);
        unsubReward();
        unsubClosed();
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      }
    });
  }

  cleanup() {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
    this.listeners.clear();
  }
}

export const adPreloader = new AdPreloaderService();
export default adPreloader;
