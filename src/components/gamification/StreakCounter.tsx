/**
 * Streak Counter Component
 *
 * Displays current and longest streak with fire animation.
 */

import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { useGamificationStore } from '@/stores/gamificationStore';
import { Flame, Trophy } from 'lucide-react-native';

interface StreakCounterProps {
  compact?: boolean;
}

export function StreakCounter({ compact = false }: StreakCounterProps) {
  const { colors } = useTheme();
  const { streak } = useGamificationStore();

  const flameScale = useSharedValue(1);

  useEffect(() => {
    if (streak.current > 0) {
      flameScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );
    }
  }, [streak.current]);

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flameScale.value }],
  }));

  if (compact) {
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: streak.current > 0 ? colors.warning + '20' : colors.surface,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 20,
        }}
      >
        <Animated.View style={flameStyle}>
          <Flame
            size={16}
            color={streak.current > 0 ? colors.warning : colors.textMuted}
            fill={streak.current > 0 ? colors.warning : 'transparent'}
          />
        </Animated.View>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '700',
            color: streak.current > 0 ? colors.warning : colors.textMuted,
            marginLeft: 4,
          }}
        >
          {streak.current}
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {/* Current Streak */}
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Animated.View style={flameStyle}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: streak.current > 0 ? colors.warning + '20' : colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Flame
                size={28}
                color={streak.current > 0 ? colors.warning : colors.textMuted}
                fill={streak.current > 0 ? colors.warning : 'transparent'}
              />
            </View>
          </Animated.View>
          <Text
            style={{
              fontSize: 24,
              fontWeight: '700',
              color: colors.text,
              marginTop: 8,
            }}
          >
            {streak.current}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            Day Streak
          </Text>
        </View>

        {/* Divider */}
        <View
          style={{
            width: 1,
            backgroundColor: colors.border,
            marginHorizontal: 16,
          }}
        />

        {/* Longest Streak */}
        <View style={{ alignItems: 'center', flex: 1 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.primary + '20',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Trophy size={28} color={colors.primary} />
          </View>
          <Text
            style={{
              fontSize: 24,
              fontWeight: '700',
              color: colors.text,
              marginTop: 8,
            }}
          >
            {streak.longest}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            Best Streak
          </Text>
        </View>
      </View>

      {/* Motivation text */}
      {streak.current > 0 && (
        <Text
          style={{
            textAlign: 'center',
            marginTop: 12,
            fontSize: 13,
            color: colors.textSecondary,
          }}
        >
          {streak.current >= 7
            ? "You're on fire! Keep it going!"
            : streak.current >= 3
            ? 'Great consistency! Almost a week!'
            : 'Building momentum. Come back tomorrow!'}
        </Text>
      )}
    </Animated.View>
  );
}

export default StreakCounter;
