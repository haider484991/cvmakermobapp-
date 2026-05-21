/**
 * XP Progress Bar Component
 *
 * Shows current XP progress towards the next level
 * with animated fill and level indicators.
 */

import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDelay,
  FadeIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { useGamificationStore, LEVEL_DEFINITIONS } from '@/stores/gamificationStore';
import { Zap } from 'lucide-react-native';

interface XPProgressBarProps {
  showLevel?: boolean;
  compact?: boolean;
}

export function XPProgressBar({ showLevel = true, compact = false }: XPProgressBarProps) {
  const { colors } = useTheme();
  const { totalXP, currentLevel, getProgressToNextLevel } = useGamificationStore();

  const progress = getProgressToNextLevel();
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    progressWidth.value = withDelay(300, withSpring(progress, { damping: 15 }));
  }, [progress]);

  const animatedBarStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const nextLevel = LEVEL_DEFINITIONS.find(l => l.level === currentLevel.level + 1);
  const xpToNext = nextLevel ? nextLevel.minXP - totalXP : 0;

  if (compact) {
    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 16 }}>{currentLevel.icon}</Text>
          <View style={{ flex: 1 }}>
            <View
              style={{
                height: 6,
                backgroundColor: colors.border,
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <Animated.View style={[animatedBarStyle, { height: '100%' }]}>
                <LinearGradient
                  colors={[colors.primary, colors.success]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1, borderRadius: 3 }}
                />
              </Animated.View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Zap size={12} color={colors.warning} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text, marginLeft: 2 }}>
              {totalXP}
            </Text>
          </View>
        </View>
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
      {/* Header with level info */}
      {showLevel && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 28, marginRight: 8 }}>{currentLevel.icon}</Text>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                Level {currentLevel.level}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                {currentLevel.name}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Zap size={16} color={colors.warning} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginLeft: 4 }}>
                {totalXP}
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: colors.textMuted }}>Total XP</Text>
          </View>
        </View>
      )}

      {/* Progress bar */}
      <View
        style={{
          height: 12,
          backgroundColor: colors.border,
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        <Animated.View style={[animatedBarStyle, { height: '100%' }]}>
          <LinearGradient
            colors={[colors.primary, colors.success]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1, borderRadius: 6 }}
          />
        </Animated.View>
      </View>

      {/* Progress text */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <Text style={{ fontSize: 12, color: colors.textMuted }}>
          {Math.round(progress)}% to Level {currentLevel.level + 1}
        </Text>
        {nextLevel && (
          <Text style={{ fontSize: 12, color: colors.textMuted }}>
            {xpToNext} XP needed
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

export default XPProgressBar;
