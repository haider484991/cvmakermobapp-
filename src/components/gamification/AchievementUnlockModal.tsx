/**
 * Achievement Unlock Modal
 *
 * Celebratory modal shown when user unlocks an achievement.
 * Features confetti animation and celebration effects.
 */

import React, { useEffect } from 'react';
import { View, Text, Modal, Pressable, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withDelay,
  withTiming,
  runOnJS,
  FadeIn,
  FadeOut,
  ZoomIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { Confetti } from '@/components/ui';
import type { Achievement } from '@/stores/gamificationStore';

interface AchievementUnlockModalProps {
  achievement: Achievement | null;
  visible: boolean;
  onClose: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function AchievementUnlockModal({
  achievement,
  visible,
  onClose,
}: AchievementUnlockModalProps) {
  const { colors } = useTheme();

  const iconScale = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible && achievement) {
      // Trigger haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Animate icon
      iconScale.value = withSequence(
        withSpring(1.3, { damping: 8 }),
        withSpring(1, { damping: 10 })
      );

      // Animate glow
      glowOpacity.value = withSequence(
        withTiming(1, { duration: 300 }),
        withDelay(500, withTiming(0.5, { duration: 500 }))
      );
    } else {
      iconScale.value = 0;
      glowOpacity.value = 0;
    }
  }, [visible, achievement]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  if (!achievement) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.8)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Confetti */}
        {visible && <Confetti active count={60} duration={4000} />}

        <Animated.View
          entering={ZoomIn.duration(400)}
          exiting={FadeOut.duration(200)}
          style={{
            width: SCREEN_WIDTH * 0.85,
            backgroundColor: colors.surface,
            borderRadius: 24,
            padding: 32,
            alignItems: 'center',
          }}
        >
          {/* Glow effect */}
          <Animated.View
            style={[
              glowStyle,
              {
                position: 'absolute',
                top: 20,
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: colors.warning,
                opacity: 0.3,
              },
            ]}
          />

          {/* Achievement Icon */}
          <Animated.View
            style={[
              iconStyle,
              {
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: colors.warning + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              },
            ]}
          >
            <Text style={{ fontSize: 56 }}>{achievement.icon}</Text>
          </Animated.View>

          {/* Title */}
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: colors.warning,
              textTransform: 'uppercase',
              letterSpacing: 2,
              marginBottom: 8,
            }}
          >
            Achievement Unlocked!
          </Text>

          {/* Achievement Name */}
          <Text
            style={{
              fontSize: 24,
              fontWeight: '700',
              color: colors.text,
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            {achievement.name}
          </Text>

          {/* Description */}
          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary,
              textAlign: 'center',
              marginBottom: 20,
            }}
          >
            {achievement.description}
          </Text>

          {/* XP Reward */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.success + '20',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 20,
              marginBottom: 24,
            }}
          >
            <Text style={{ fontSize: 20, marginRight: 8 }}>⚡</Text>
            <Text
              style={{
                fontSize: 18,
                fontWeight: '700',
                color: colors.success,
              }}
            >
              +{achievement.xpReward} XP
            </Text>
          </View>

          {/* Close Button */}
          <Pressable
            onPress={onClose}
            style={{ width: '100%' }}
          >
            <LinearGradient
              colors={[colors.primary, '#4f46e5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: 'white',
                  fontSize: 16,
                  fontWeight: '600',
                }}
              >
                Awesome!
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default AchievementUnlockModal;
