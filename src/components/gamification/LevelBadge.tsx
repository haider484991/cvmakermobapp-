/**
 * Level Badge Component
 *
 * Displays the user's current level with icon and name.
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { useGamificationStore } from '@/stores/gamificationStore';

interface LevelBadgeProps {
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
  showName?: boolean;
}

export function LevelBadge({ size = 'medium', onPress, showName = true }: LevelBadgeProps) {
  const { colors } = useTheme();
  const { currentLevel, totalXP } = useGamificationStore();
  const scale = useSharedValue(1);

  const sizeConfig = {
    small: { icon: 20, container: 36, fontSize: 10 },
    medium: { icon: 28, container: 48, fontSize: 12 },
    large: { icon: 40, container: 72, fontSize: 16 },
  };

  const config = sizeConfig[size];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(1.1, { damping: 10 });
    setTimeout(() => {
      scale.value = withSpring(1, { damping: 8 });
    }, 100);
    onPress?.();
  };

  return (
    <Pressable onPress={onPress ? handlePress : undefined}>
      <Animated.View
        entering={FadeIn.duration(300)}
        style={[
          animatedStyle,
          { flexDirection: 'row', alignItems: 'center' },
        ]}
      >
        <LinearGradient
          colors={[currentLevel.color, currentLevel.color + '80']}
          style={{
            width: config.container,
            height: config.container,
            borderRadius: config.container / 2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: config.icon }}>{currentLevel.icon}</Text>
        </LinearGradient>

        {showName && (
          <View style={{ marginLeft: 10 }}>
            <Text
              style={{
                fontSize: config.fontSize,
                fontWeight: '700',
                color: colors.text,
              }}
            >
              Level {currentLevel.level}
            </Text>
            <Text
              style={{
                fontSize: config.fontSize - 2,
                color: colors.textSecondary,
              }}
            >
              {currentLevel.name}
            </Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

export default LevelBadge;
