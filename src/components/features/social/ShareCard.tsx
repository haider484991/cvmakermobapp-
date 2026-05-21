/**
 * Share Card Component
 * Card for sharing achievements, inviting friends, and referrals
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Share2,
  Users,
  Gift,
  Copy,
  Check,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import {
  shareReferralLink,
  shareApp,
  copyReferralCode,
  initReferralCode,
} from '@/services/social/sharing';
import { useGamification } from '@/hooks/useGamification';

interface ShareCardProps {
  variant?: 'invite' | 'share' | 'referral';
  onShare?: () => void;
}

export function ShareCard({ variant = 'invite', onShare }: ShareCardProps) {
  const { colors } = useTheme();
  const { hapticEnabled } = useUIStore();
  const { trackShare } = useGamification();
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [referralCode, setReferralCode] = useState('');

  // Initialize referral code on mount
  useEffect(() => {
    const code = initReferralCode();
    setReferralCode(code);
  }, []);

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);

    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const result = variant === 'invite'
        ? await shareReferralLink()
        : await shareApp();

      if (result.success) {
        trackShare();
        onShare?.();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyCode = async () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const success = await copyReferralCode();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (variant === 'referral') {
    return (
      <Animated.View entering={FadeInUp}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.primary + '15',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Gift size={20} color={colors.primary} />
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
                Your Referral Code
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                Share to earn 100 XP per friend!
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.background,
              borderRadius: 12,
              padding: 12,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 20,
                fontWeight: '700',
                color: colors.primary,
                letterSpacing: 2,
              }}
            >
              {referralCode}
            </Text>
            <Pressable
              onPress={handleCopyCode}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.primary + '15',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
              }}
            >
              {copied ? (
                <>
                  <Check size={16} color={colors.success} />
                  <Text
                    style={{
                      marginLeft: 4,
                      fontSize: 13,
                      fontWeight: '600',
                      color: colors.success,
                    }}
                  >
                    Copied!
                  </Text>
                </>
              ) : (
                <>
                  <Copy size={16} color={colors.primary} />
                  <Text
                    style={{
                      marginLeft: 4,
                      fontSize: 13,
                      fontWeight: '600',
                      color: colors.primary,
                    }}
                  >
                    Copy
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          <Pressable
            onPress={handleShare}
            disabled={isSharing}
            style={{ marginTop: 12 }}
          >
            <LinearGradient
              colors={[colors.primary, '#4f46e5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 12,
                borderRadius: 12,
                opacity: isSharing ? 0.7 : 1,
              }}
            >
              <Share2 size={18} color="white" />
              <Text
                style={{
                  marginLeft: 8,
                  fontSize: 15,
                  fontWeight: '600',
                  color: 'white',
                }}
              >
                {isSharing ? 'Sharing...' : 'Share Invite Link'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp}>
      <Pressable
        onPress={handleShare}
        disabled={isSharing}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          opacity: isSharing ? 0.7 : 1,
        }}
      >
        <LinearGradient
          colors={variant === 'invite' ? ['#22c55e', '#16a34a'] : [colors.primary, '#4f46e5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {variant === 'invite' ? (
            <Users size={24} color="white" />
          ) : (
            <Share2 size={24} color="white" />
          )}
        </LinearGradient>

        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
            {variant === 'invite' ? 'Invite Friends' : 'Share App'}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>
            {variant === 'invite'
              ? 'Earn 100 XP for each friend who joins!'
              : 'Help others create amazing resumes'}
          </Text>
        </View>

        <ChevronRight size={20} color={colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

export default ShareCard;
