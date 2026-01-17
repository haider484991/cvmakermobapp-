/**
 * Ad Preloader Service
 * Preloads rewarded ads in the background when the app starts
 * so they're ready by the time the user needs them.
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';

// Ad Unit ID
const PRODUCTION_AD_UNIT_ID = 'ca-app-pub-6873688003145340/5972479923';

// Check if running in Expo Go
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

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
  private TestIds: any = null;
  private unsubscribers: (() => void)[] = [];

  constructor() {
    this.initializeAdMob();
  }

  private initializeAdMob() {
    if (isExpoGo) {
      console.log('[AdPreloader] Running in Expo Go, ads disabled');
      return;
    }

    try {
      const mobileAds = require('react-native-google-mobile-ads');
      this.RewardedAd = mobileAds.RewardedAd;
      this.RewardedAdEventType = mobileAds.RewardedAdEventType;
      this.AdEventType = mobileAds.AdEventType;
      this.TestIds = mobileAds.TestIds;

      this.createAdInstance();
    } catch (error) {
      console.log('[AdPreloader] AdMob not available:', error);
    }
  }

  private createAdInstance() {
    if (!this.RewardedAd) return;

    const adUnitId = __DEV__ ? this.TestIds.REWARDED : PRODUCTION_AD_UNIT_ID;

    this.rewardedAd = this.RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
      keywords: ['resume', 'job', 'career', 'employment'],
    });

    // Set up listeners
    this.setupListeners();
  }

  private setupListeners() {
    if (!this.rewardedAd) return;

    // Clear old listeners
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    const unsubLoaded = this.rewardedAd.addAdEventListener(
      this.RewardedAdEventType.LOADED,
      () => {
        console.log('[AdPreloader] Ad loaded successfully');
        this.isLoaded = true;
        this.isLoading = false;
        this.loadAttempts = 0;
        this.notifyListeners(true);
      }
    );

    const unsubError = this.rewardedAd.addAdEventListener(
      this.AdEventType.ERROR,
      (error: any) => {
        console.log('[AdPreloader] Ad load error:', error?.message);
        this.isLoaded = false;
        this.isLoading = false;

        // Retry with exponential backoff
        if (this.loadAttempts < this.maxAttempts) {
          const delay = Math.min(3000 * Math.pow(2, this.loadAttempts), 30000);
          console.log(`[AdPreloader] Retrying in ${delay}ms (attempt ${this.loadAttempts + 1}/${this.maxAttempts})`);
          setTimeout(() => this.preload(), delay);
        } else {
          console.log('[AdPreloader] Max attempts reached');
          this.notifyListeners(false);
        }
      }
    );

    const unsubClosed = this.rewardedAd.addAdEventListener(
      this.AdEventType.CLOSED,
      () => {
        console.log('[AdPreloader] Ad closed, preloading next');
        this.isLoaded = false;
        this.loadAttempts = 0;
        // Preload next ad after a short delay
        setTimeout(() => this.preload(), 1000);
      }
    );

    this.unsubscribers.push(unsubLoaded, unsubError, unsubClosed);
  }

  /**
   * Start preloading the ad
   */
  preload(): void {
    if (isExpoGo || !this.rewardedAd) {
      console.log('[AdPreloader] Cannot preload - not available');
      return;
    }

    if (this.isLoaded || this.isLoading) {
      console.log('[AdPreloader] Already loaded or loading');
      return;
    }

    this.isLoading = true;
    this.loadAttempts++;

    try {
      console.log(`[AdPreloader] Starting preload (attempt ${this.loadAttempts})`);
      this.rewardedAd.load();
    } catch (error) {
      console.error('[AdPreloader] Preload error:', error);
      this.isLoading = false;
    }
  }

  /**
   * Check if ad is ready
   */
  isReady(): boolean {
    return this.isLoaded;
  }

  /**
   * Check if ad is currently loading
   */
  isCurrentlyLoading(): boolean {
    return this.isLoading;
  }

  /**
   * Get the ad instance for showing
   */
  getAd(): any {
    return this.rewardedAd;
  }

  /**
   * Subscribe to load state changes
   */
  subscribe(callback: (loaded: boolean) => void): () => void {
    this.listeners.add(callback);
    // Immediately notify of current state
    callback(this.isLoaded);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(loaded: boolean) {
    this.listeners.forEach(callback => callback(loaded));
  }

  /**
   * Show the ad and return promise
   */
  async showAd(): Promise<boolean> {
    if (!this.isLoaded || !this.rewardedAd) {
      console.log('[AdPreloader] Ad not ready');
      return false;
    }

    return new Promise((resolve) => {
      let resolved = false;

      const unsubReward = this.rewardedAd.addAdEventListener(
        this.RewardedAdEventType.EARNED_REWARD,
        () => {
          console.log('[AdPreloader] User earned reward');
          if (!resolved) {
            resolved = true;
            resolve(true);
          }
        }
      );

      const unsubClosed = this.rewardedAd.addAdEventListener(
        this.AdEventType.CLOSED,
        () => {
          console.log('[AdPreloader] Ad closed');
          unsubReward();
          unsubClosed();
          this.isLoaded = false;
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
          // Preload next ad
          setTimeout(() => this.preload(), 500);
        }
      );

      try {
        this.rewardedAd.show();
      } catch (error) {
        console.error('[AdPreloader] Show error:', error);
        unsubReward();
        unsubClosed();
        resolve(false);
      }
    });
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.listeners.clear();
  }
}

// Export singleton instance
export const adPreloader = new AdPreloaderService();

export default adPreloader;
