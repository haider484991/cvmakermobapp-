import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { gradientColors } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'light' | 'solid';
  onPress?: () => void;
  disabled?: boolean;
  noPadding?: boolean;
}

/**
 * GlassCard component
 *
 * A glassmorphism-style card with semi-transparent background
 * and subtle border, designed for use on gradient backgrounds.
 */
export function GlassCard({
  children,
  style,
  variant = 'default',
  onPress,
  disabled,
  noPadding,
}: GlassCardProps) {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (onPress && !disabled) {
      scale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getBackgroundColor = () => {
    switch (variant) {
      case 'light':
        return gradientColors.glassLight;
      case 'solid':
        return '#FFFFFF';
      default:
        return gradientColors.glass;
    }
  };

  const getBorderColor = () => {
    switch (variant) {
      case 'light':
      case 'solid':
        return 'rgba(255, 255, 255, 0.5)';
      default:
        return gradientColors.glassBorder;
    }
  };

  const cardStyle = [
    styles.card,
    {
      backgroundColor: getBackgroundColor(),
      borderColor: getBorderColor(),
    },
    noPadding && styles.noPadding,
    style,
  ];

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[animatedStyle, cardStyle, disabled && styles.disabled]}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
  },
  noPadding: {
    padding: 0,
  },
  disabled: {
    opacity: 0.6,
  },
});

export default GlassCard;
