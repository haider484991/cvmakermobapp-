/**
 * PaywallModal — the screen users see when they hit a premium gate.
 *
 * Soft-paywall philosophy: lists what they unlock as benefits (not what
 * they lose by staying free), shows three SKUs with annual flagged as
 * best value, supports restore purchases, and complies with Google Play
 * subscription disclosure requirements (price + period visible before
 * purchase, terms + privacy linked).
 */

import React, { useEffect, useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Check,
  Crown,
  X,
  Sparkles,
  Star,
  Zap,
  Palette,
  Shield,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { usePremium, useOfferings } from '@/hooks/usePremium';
import { usePurchasesStore } from '@/stores/purchasesStore';
import { buyProduct, restorePurchases } from '@/services/purchases/purchases';
import type { Offering } from '@/services/purchases/purchases';
import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Where the user was when they hit the paywall — for analytics + headline */
  trigger?:
    | 'template'
    | 'watermark'
    | 'ads'
    | 'ai_score'
    | 'profile'
    | 'generic';
}

const FEATURES = [
  { icon: Palette, label: 'All 22 premium templates' },
  { icon: Shield, label: 'Remove watermark on PDF exports' },
  { icon: Sparkles, label: 'Full AI Resume Score & coaching' },
  { icon: Zap, label: 'No ads, ever' },
  { icon: Star, label: 'Priority support & new features first' },
];

const TRIGGER_HEADLINES: Record<NonNullable<Props['trigger']>, string> = {
  template: 'Unlock this template',
  watermark: 'Remove the watermark',
  ads: 'Tired of ads? Go Pro',
  ai_score: 'Unlock the full AI analysis',
  profile: 'Upgrade to FreeResume Pro',
  generic: 'Upgrade to FreeResume Pro',
};

export function PaywallModal({ visible, onClose, trigger = 'generic' }: Props) {
  const { colors } = useTheme();
  const { hapticEnabled } = useUIStore();
  const { isPremium } = usePremium();
  const { offerings, loading } = useOfferings();
  const isPurchasing = usePurchasesStore((s) => s.isPurchasing);
  const lastError = usePurchasesStore((s) => s.lastError);

  // Track when the paywall opens so we can compute funnel.
  useEffect(() => {
    if (visible) {
      track(ANALYTICS_EVENTS.PAYWALL_SHOWN, { trigger });
    }
  }, [visible, trigger]);

  // Annual is the "best value" tier, surfaced first; monthly + lifetime below.
  const sortedOfferings = useMemo(() => {
    const order = { annual: 0, monthly: 1, lifetime: 2 } as const;
    return [...offerings].sort((a, b) => order[a.tier] - order[b.tier]);
  }, [offerings]);

  // Selected sku — default to annual when it exists.
  const annualOffering = sortedOfferings.find((o) => o.tier === 'annual');
  const [selectedSku, setSelectedSku] = React.useState<string | null>(
    annualOffering?.sku ?? null,
  );

  // Keep selectedSku in sync once offerings load.
  useEffect(() => {
    if (!selectedSku && annualOffering) setSelectedSku(annualOffering.sku);
  }, [annualOffering, selectedSku]);

  // If the user becomes premium while the modal is open, close it.
  useEffect(() => {
    if (visible && isPremium) onClose();
  }, [visible, isPremium, onClose]);

  const handleClose = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    track(ANALYTICS_EVENTS.PAYWALL_DISMISSED, { trigger, had_selection: !!selectedSku });
    onClose();
  };

  const handlePurchase = async () => {
    if (!selectedSku || isPurchasing) return;
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await buyProduct(selectedSku);
  };

  const handleRestore = async () => {
    if (isPurchasing) return;
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const { found } = await restorePurchases();
    if (found === 0) {
      usePurchasesStore.getState().setError('No active purchase found on this account.');
    }
  };

  const headline = TRIGGER_HEADLINES[trigger];
  const selected = sortedOfferings.find((o) => o.sku === selectedSku) || null;
  const ctaLabel = selected?.trialDays
    ? `Start ${selected.trialDays}-day free trial`
    : selected?.tier === 'lifetime'
      ? 'Buy lifetime'
      : 'Subscribe now';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Close (X) */}
        <Pressable
          onPress={handleClose}
          hitSlop={8}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 10,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={20} color={colors.text} />
        </Pressable>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <Animated.View entering={FadeIn.duration(300)}>
            <LinearGradient
              colors={[colors.primary, '#06B6D4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                padding: 32,
                paddingTop: 48,
                paddingBottom: 32,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: 'rgba(255,255,255,0.22)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.35)',
                }}
              >
                <Crown size={36} color="white" strokeWidth={2.4} />
              </View>
              <Text
                style={{
                  color: 'white',
                  fontSize: 28,
                  fontWeight: '800',
                  textAlign: 'center',
                  letterSpacing: -0.5,
                }}
              >
                {headline}
              </Text>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.92)',
                  fontSize: 14,
                  textAlign: 'center',
                  marginTop: 8,
                  maxWidth: 280,
                  lineHeight: 20,
                }}
              >
                Everything you need to build a resume that gets you hired.
              </Text>
            </LinearGradient>
          </Animated.View>

          {/* Benefits */}
          <View style={{ padding: 24, paddingBottom: 16 }}>
            {FEATURES.map((f, i) => (
              <Animated.View
                key={f.label}
                entering={FadeInUp.delay(100 + i * 60)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 14,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: colors.primary + '15',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <f.icon size={16} color={colors.primary} />
                </View>
                <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: '500' }}>
                  {f.label}
                </Text>
                <Check size={18} color={colors.success} />
              </Animated.View>
            ))}
          </View>

          {/* Pricing tiers */}
          <View style={{ paddingHorizontal: 20 }}>
            {loading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : sortedOfferings.length === 0 ? (
              // v1.8.3 — when Play Billing returns no products we DO NOT
              // show fallback USD prices (Subscriptions policy: displayed
              // currency must match Play checkout sheet's localized
              // currency). Instead show a neutral unavailable state.
              <View
                style={{
                  paddingVertical: 28,
                  paddingHorizontal: 16,
                  alignItems: 'center',
                  borderRadius: 16,
                  backgroundColor: colors.surface,
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 15,
                    fontWeight: '600',
                    textAlign: 'center',
                    marginBottom: 6,
                  }}
                >
                  Pricing temporarily unavailable
                </Text>
                <Text
                  style={{
                    color: colors.text + '99',
                    fontSize: 13,
                    textAlign: 'center',
                    lineHeight: 18,
                  }}
                >
                  We couldn&rsquo;t load your country&rsquo;s prices from
                  Google Play. Please check your connection and try
                  again, or come back in a few minutes.
                </Text>
              </View>
            ) : (
              sortedOfferings.map((offering) => (
                <OfferingCard
                  key={offering.sku}
                  offering={offering}
                  selected={offering.sku === selectedSku}
                  onSelect={() => setSelectedSku(offering.sku)}
                />
              ))
            )}
          </View>

          {/* Error message */}
          {lastError && (
            <View
              style={{
                marginHorizontal: 20,
                marginTop: 8,
                padding: 12,
                borderRadius: 10,
                backgroundColor: colors.error + '15',
              }}
            >
              <Text style={{ color: colors.error, fontSize: 13 }}>{lastError}</Text>
            </View>
          )}

          {/* CTA + secondary actions */}
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <Pressable
              onPress={handlePurchase}
              disabled={!selectedSku || isPurchasing}
              style={{
                paddingVertical: 16,
                borderRadius: 16,
                backgroundColor: colors.primary,
                alignItems: 'center',
                opacity: !selectedSku || isPurchasing ? 0.6 : 1,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              {isPurchasing ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>
                  {ctaLabel}
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={handleRestore}
              disabled={isPurchasing}
              style={{ marginTop: 12, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '500' }}>
                Restore purchases
              </Text>
            </Pressable>
          </View>

          {/* Compliance footer */}
          <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 11,
                lineHeight: 16,
                textAlign: 'center',
              }}
            >
              Subscriptions auto-renew until cancelled. Cancel anytime in Google Play.
              Trial converts to paid plan unless cancelled at least 24h before it ends.
              {'\n\n'}
              <Text
                style={{ textDecorationLine: 'underline' }}
                onPress={() => Linking.openURL('https://haider484991.github.io/cvmakermobapp-/privacy/')}
              >
                Privacy
              </Text>
              {' · '}
              <Text
                style={{ textDecorationLine: 'underline' }}
                onPress={() => Linking.openURL('https://haider484991.github.io/cvmakermobapp-/help/')}
              >
                Terms
              </Text>
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Offering card                                                              */
/* -------------------------------------------------------------------------- */

function OfferingCard({
  offering,
  selected,
  onSelect,
}: {
  offering: Offering;
  selected: boolean;
  onSelect: () => void;
}) {
  const { colors } = useTheme();
  const isBestValue = offering.tier === 'annual';
  const subtitle =
    offering.tier === 'lifetime'
      ? 'Pay once, own forever'
      : offering.tier === 'annual'
        ? `Save 44% · ${offering.trialDays}-day free trial`
        : `${offering.trialDays}-day free trial`;
  const priceDisplay =
    offering.tier === 'lifetime'
      ? offering.priceText
      : `${offering.priceText}/${offering.period === 'year' ? 'year' : 'month'}`;
  const tierLabel =
    offering.tier === 'lifetime'
      ? 'Lifetime'
      : offering.tier === 'annual'
        ? 'Annual'
        : 'Monthly';

  return (
    <Pressable
      onPress={onSelect}
      style={{
        marginBottom: 10,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primary + '08' : colors.surface,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      {isBestValue && (
        <View
          style={{
            position: 'absolute',
            top: -10,
            right: 16,
            backgroundColor: '#FBBF24',
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: '#0F172A', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 }}>
            BEST VALUE
          </Text>
        </View>
      )}
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primary : 'transparent',
          marginRight: 14,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected && <Check size={14} color="white" strokeWidth={3} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
          {tierLabel}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
          {subtitle}
        </Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
        {priceDisplay}
      </Text>
    </Pressable>
  );
}

export default PaywallModal;
