/**
 * NativeAdCard Component
 *
 * A native ad styled to look like a template card.
 * Includes required AdBadge for policy compliance.
 */

import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useTheme } from '@/hooks/useTheme';

// Check if running in Expo Go
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Ad Unit IDs
const PRODUCTION_AD_UNIT_ID = 'ca-app-pub-6873688003145340/8010458085';

// Safe lazy loading of AdMob native ad components
let NativeAd: any;
let NativeAdView: any;
let NativeMediaView: any;
let NativeAsset: any;
let TestIds: any;
let AdEventType: any;
let isAdMobAvailable = false;

try {
  if (!isExpoGo) {
    const mobileAds = require('react-native-google-mobile-ads');
    NativeAd = mobileAds.NativeAd;
    NativeAdView = mobileAds.NativeAdView;
    NativeMediaView = mobileAds.NativeMediaView;
    NativeAsset = mobileAds.NativeAsset;
    TestIds = mobileAds.TestIds;
    AdEventType = mobileAds.AdEventType;
    isAdMobAvailable = true;
  }
} catch (error) {
  console.log('[NativeAdCard] AdMob native module not available, ads will not be shown');
}

// Use test ads in development to prevent account bans
const adUnitId = isAdMobAvailable && TestIds ? (__DEV__ ? TestIds.NATIVE : PRODUCTION_AD_UNIT_ID) : '';

interface NativeAdCardProps {
  /** Optional style override */
  style?: object;
}

export function NativeAdCard({ style }: NativeAdCardProps) {
  const { colors } = useTheme();
  const nativeAdViewRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [nativeAd, setNativeAd] = useState<any>(null);

  useEffect(() => {
    // If AdMob is not available, don't try to load ads
    if (!isAdMobAvailable || !NativeAd || !NativeAdView || !NativeMediaView || !NativeAsset) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    try {
      // Create and load the native ad
      const ad = NativeAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      const unsubscribeLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
        console.log('[NativeAdCard] Ad loaded');
        setNativeAd(ad);
        setIsLoading(false);
      });

      const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, (error: any) => {
        console.error('[NativeAdCard] Ad error:', error);
        setHasError(true);
        setIsLoading(false);
      });

      ad.load();

      return () => {
        unsubscribeLoaded();
        unsubscribeError();
        ad.destroy();
      };
    } catch (error) {
      console.error('[NativeAdCard] Failed to create ad:', error);
      setHasError(true);
      setIsLoading(false);
    }
  }, []);

  // Don't render anything if there's an error
  if (hasError) {
    return null;
  }

  // Show loading state
  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.surface,
            shadowColor: '#000',
            height: 300,
            justifyContent: 'center',
            alignItems: 'center',
          },
          style,
        ]}
      >
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Loading...
        </Text>
      </View>
    );
  }

  if (!nativeAd || !NativeAdView || !NativeMediaView || !NativeAsset) {
    return null;
  }

  return (
    <NativeAdView
      ref={nativeAdViewRef}
      nativeAd={nativeAd}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          shadowColor: '#000',
        },
        style,
      ]}
    >
      {/* Ad Badge - REQUIRED for policy compliance */}
      <View style={[styles.adBadge, { backgroundColor: colors.success }]}>
        <Text style={styles.adBadgeText}>Ad</Text>
      </View>

      {/* Media View (Image/Video) */}
      <NativeMediaView
        style={styles.mediaView}
        resizeMode="cover"
      />

      {/* Ad Content */}
      <View style={styles.contentContainer}>
        {/* Icon and Headline Row */}
        <View style={styles.headerRow}>
          {/* Icon View */}
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: colors.primary + '15' },
            ]}
          >
            <NativeAsset.IconView
              style={styles.iconView}
            />
          </View>

          {/* Headline and Tagline */}
          <View style={styles.textContainer}>
            <NativeAsset.HeadlineView
              style={[styles.headline, { color: colors.text }]}
              numberOfLines={2}
            />
            <NativeAsset.TaglineView
              style={[styles.tagline, { color: colors.textSecondary }]}
              numberOfLines={2}
            />
          </View>
        </View>

        {/* Store and Rating Row */}
        <View style={styles.storeRow}>
          <NativeAsset.StoreView
            style={[styles.storeText, { color: colors.textMuted }]}
          />
          <NativeAsset.StarRatingView
            style={styles.starRating}
          />
        </View>

        {/* Call to Action Button */}
        <NativeAsset.CallToActionView
          style={[
            styles.ctaButton,
            { backgroundColor: colors.primary },
          ]}
          textStyle={styles.ctaButtonText}
          allowFontScaling={false}
        />
      </View>
    </NativeAdView>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  adBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  adBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  mediaView: {
    width: '100%',
    height: 140,
    backgroundColor: '#f0f0f0',
  },
  contentContainer: {
    flex: 1,
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
  },
  iconView: {
    width: 48,
    height: 48,
  },
  textContainer: {
    flex: 1,
  },
  headline: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 13,
    lineHeight: 18,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  storeText: {
    fontSize: 12,
    marginRight: 8,
  },
  starRating: {
    flexDirection: 'row',
  },
  ctaButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
  },
});

export default NativeAdCard;
