/**
 * Achievement Badge Component
 *
 * Displays an achievement with icon, name, description, and progress.
 * Shows locked/unlocked state with appropriate styling.
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withSequence,
  useSharedValue,
  FadeIn,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { Lock } from 'lucide-react-native';
import type { Achievement } from '@/stores/gamificationStore';

interface AchievementBadgeProps {
  achievement: Achievement;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
  showProgress?: boolean;
}

export function AchievementBadge({
  achievement,
  size = 'medium',
  onPress,
  showProgress = true,
}: AchievementBadgeProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const isUnlocked = !!achievement.unlockedAt;
  const progress = Math.min(achievement.progress / achievement.requirement, 1);

  const sizeConfig = {
    small: { icon: 24, container: 48, fontSize: 10 },
    medium: { icon: 32, container: 64, fontSize: 12 },
    large: { icon: 48, container: 80, fontSize: 14 },
  };

  const config = sizeConfig[size];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSequence(
      withSpring(0.9, { damping: 10 }),
      withSpring(1, { damping: 8 })
    );
    onPress?.();
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        entering={FadeIn.duration(300)}
        style={[
          animatedStyle,
          {
            alignItems: 'center',
            opacity: isUnlocked ? 1 : 0.5,
          },
        ]}
      >
        {/* Badge Icon Container */}
        <View
          style={{
            width: config.container,
            height: config.container,
            borderRadius: config.container / 2,
            backgroundColor: isUnlocked ? colors.primary + '20' : colors.surface,
            borderWidth: 2,
            borderColor: isUnlocked ? colors.primary : colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {isUnlocked ? (
            <Text style={{ fontSize: config.icon }}>{achievement.icon}</Text>
          ) : (
            <Lock size={config.icon * 0.6} color={colors.textMuted} />
          )}

          {/* Progress ring for locked achievements */}
          {!isUnlocked && showProgress && progress > 0 && (
            <View
              style={{
                position: 'absolute',
                top: -2,
                left: -2,
                right: -2,
                bottom: -2,
                borderRadius: config.container / 2,
                borderWidth: 2,
                borderColor: colors.primary,
                borderTopColor: 'transparent',
                borderRightColor: progress > 0.25 ? colors.primary : 'transparent',
                borderBottomColor: progress > 0.5 ? colors.primary : 'transparent',
                borderLeftColor: progress > 0.75 ? colors.primary : 'transparent',
                transform: [{ rotate: '-45deg' }],
              }}
            />
          )}
        </View>

        {/* Achievement Name */}
        {size !== 'small' && (
          <Text
            style={{
              marginTop: 6,
              fontSize: config.fontSize,
              fontWeight: '600',
              color: isUnlocked ? colors.text : colors.textMuted,
              textAlign: 'center',
              maxWidth: config.container + 20,
            }}
            numberOfLines={2}
          >
            {achievement.isSecret && !isUnlocked ? '???' : achievement.name}
          </Text>
        )}

        {/* Progress Text */}
        {!isUnlocked && showProgress && size === 'large' && (
          <Text
            style={{
              marginTop: 2,
              fontSize: 10,
              color: colors.textMuted,
            }}
          >
            {achievement.progress}/{achievement.requirement}
          </Text>
        )}

        {/* XP Reward Badge */}
        {isUnlocked && size !== 'small' && (
          <View
            style={{
              marginTop: 4,
              backgroundColor: colors.success + '20',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: colors.success,
              }}
            >
              +{achievement.xpReward} XP
            </Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

export default AchievementBadge;
