/**
 * Animated Icon Component
 * Provides animated icon displays with various effects
 */

import { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { LucideIcon, LucideProps } from 'lucide-react-native';

type AnimationType = 'pulse' | 'bounce' | 'rotate' | 'shake' | 'float' | 'none';

interface AnimatedIconProps {
  /**
   * Lucide icon component
   */
  icon: LucideIcon;

  /**
   * Icon size
   */
  size?: number;

  /**
   * Icon color
   */
  color?: string;

  /**
   * Background color for the container
   */
  backgroundColor?: string;

  /**
   * Container size (defaults to icon size + padding)
   */
  containerSize?: number;

  /**
   * Border radius for container
   */
  borderRadius?: number;

  /**
   * Animation type
   */
  animation?: AnimationType;

  /**
   * Delay before animation starts
   */
  delay?: number;

  /**
   * Additional container styles
   */
  style?: ViewStyle;
}

export function AnimatedIcon({
  icon: Icon,
  size = 32,
  color = '#FFFFFF',
  backgroundColor,
  containerSize,
  borderRadius,
  animation = 'none',
  delay = 0,
  style,
}: AnimatedIconProps) {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    switch (animation) {
      case 'pulse':
        scale.value = withDelay(
          delay,
          withRepeat(
            withSequence(
              withTiming(1.1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
              withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
          )
        );
        break;

      case 'bounce':
        translateY.value = withDelay(
          delay,
          withRepeat(
            withSequence(
              withTiming(-8, { duration: 500, easing: Easing.out(Easing.quad) }),
              withTiming(0, { duration: 500, easing: Easing.in(Easing.quad) })
            ),
            -1,
            true
          )
        );
        break;

      case 'rotate':
        rotation.value = withDelay(
          delay,
          withRepeat(
            withTiming(360, { duration: 2000, easing: Easing.linear }),
            -1,
            false
          )
        );
        break;

      case 'shake':
        translateX.value = withDelay(
          delay,
          withRepeat(
            withSequence(
              withTiming(-3, { duration: 50 }),
              withTiming(3, { duration: 100 }),
              withTiming(-3, { duration: 100 }),
              withTiming(3, { duration: 100 }),
              withTiming(0, { duration: 50 }),
              withTiming(0, { duration: 2000 }) // Pause
            ),
            -1,
            false
          )
        );
        break;

      case 'float':
        translateY.value = withDelay(
          delay,
          withRepeat(
            withSequence(
              withTiming(-6, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
              withTiming(6, { duration: 1500, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
          )
        );
        // Add subtle rotation
        rotation.value = withDelay(
          delay,
          withRepeat(
            withSequence(
              withTiming(3, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
              withTiming(-3, { duration: 2000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
          )
        );
        break;

      case 'none':
      default:
        // Initial entrance animation
        scale.value = withDelay(
          delay,
          withSpring(1, { damping: 12, stiffness: 200 })
        );
        break;
    }
  }, [animation, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  const finalContainerSize = containerSize || size + 32;
  const finalBorderRadius = borderRadius ?? finalContainerSize / 3;

  return (
    <Animated.View
      style={[
        {
          width: finalContainerSize,
          height: finalContainerSize,
          borderRadius: finalBorderRadius,
          backgroundColor: backgroundColor || 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        },
        animatedStyle,
        style,
      ]}
    >
      <Icon size={size} color={color} strokeWidth={2} />
    </Animated.View>
  );
}

export default AnimatedIcon;
