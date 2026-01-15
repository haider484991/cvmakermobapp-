/**
 * Page Indicator Component
 * Animated dots showing current page in a multi-step flow
 */

import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { SPRING_CONFIGS } from '@/utils/animations';

interface PageIndicatorProps {
  /**
   * Total number of pages
   */
  totalPages: number;

  /**
   * Current active page (0-indexed)
   */
  currentPage: number;

  /**
   * Size of the dots
   */
  size?: number;

  /**
   * Gap between dots
   */
  gap?: number;

  /**
   * Active dot color (optional, uses primary by default)
   */
  activeColor?: string;

  /**
   * Inactive dot color (optional, uses border by default)
   */
  inactiveColor?: string;
}

function Dot({
  isActive,
  size,
  activeColor,
  inactiveColor,
}: {
  isActive: boolean;
  size: number;
  activeColor: string;
  inactiveColor: string;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const scale = withSpring(isActive ? 1 : 0.8, SPRING_CONFIGS.snappy);
    const width = withSpring(isActive ? size * 2.5 : size, SPRING_CONFIGS.snappy);

    return {
      transform: [{ scale }],
      width,
      backgroundColor: isActive ? activeColor : inactiveColor,
    };
  }, [isActive, size, activeColor, inactiveColor]);

  return (
    <Animated.View
      style={[
        {
          height: size,
          borderRadius: size / 2,
        },
        animatedStyle,
      ]}
    />
  );
}

export function PageIndicator({
  totalPages,
  currentPage,
  size = 8,
  gap = 8,
  activeColor,
  inactiveColor,
}: PageIndicatorProps) {
  const { colors } = useTheme();

  const finalActiveColor = activeColor || colors.primary;
  const finalInactiveColor = inactiveColor || colors.border;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap,
      }}
    >
      {Array.from({ length: totalPages }).map((_, index) => (
        <Dot
          key={index}
          isActive={index === currentPage}
          size={size}
          activeColor={finalActiveColor}
          inactiveColor={finalInactiveColor}
        />
      ))}
    </View>
  );
}

export default PageIndicator;
