/**
 * Animated Feature List Component
 * Displays a list of features with staggered entrance animations
 */

import { View, Text, ViewStyle } from 'react-native';
import Animated, {
  FadeInRight,
  FadeInLeft,
  Layout,
} from 'react-native-reanimated';
import { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { getStaggerDelay } from '@/utils/animations';

interface Feature {
  /**
   * Icon for the feature
   */
  icon: LucideIcon;

  /**
   * Feature title/text
   */
  text: string;

  /**
   * Optional description
   */
  description?: string;

  /**
   * Optional icon color override
   */
  iconColor?: string;
}

interface AnimatedFeatureListProps {
  /**
   * List of features to display
   */
  features: Feature[];

  /**
   * Base delay before animations start
   */
  baseDelay?: number;

  /**
   * Delay between each item
   */
  staggerDelay?: number;

  /**
   * Animation direction
   */
  direction?: 'left' | 'right';

  /**
   * Icon size
   */
  iconSize?: number;

  /**
   * Show icon background
   */
  showIconBackground?: boolean;

  /**
   * Additional container style
   */
  style?: ViewStyle;
}

export function AnimatedFeatureList({
  features,
  baseDelay = 0,
  staggerDelay = 100,
  direction = 'left',
  iconSize = 24,
  showIconBackground = true,
  style,
}: AnimatedFeatureListProps) {
  const { colors } = useTheme();

  const EnterAnimation = direction === 'left' ? FadeInLeft : FadeInRight;

  return (
    <View style={[{ gap: 16 }, style]}>
      {features.map((feature, index) => {
        const Icon = feature.icon;
        const delay = baseDelay + getStaggerDelay(index, staggerDelay);

        return (
          <Animated.View
            key={index}
            entering={EnterAnimation.delay(delay).springify().damping(15)}
            layout={Layout.springify()}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
            }}
          >
            {showIconBackground ? (
              <View
                style={{
                  width: iconSize + 20,
                  height: iconSize + 20,
                  borderRadius: (iconSize + 20) / 2,
                  backgroundColor: (feature.iconColor || colors.primary) + '15',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon
                  size={iconSize}
                  color={feature.iconColor || colors.primary}
                  strokeWidth={2}
                />
              </View>
            ) : (
              <Icon
                size={iconSize}
                color={feature.iconColor || colors.primary}
                strokeWidth={2}
              />
            )}

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '500',
                  color: colors.text,
                }}
              >
                {feature.text}
              </Text>
              {feature.description && (
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.textSecondary,
                    marginTop: 2,
                  }}
                >
                  {feature.description}
                </Text>
              )}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

export default AnimatedFeatureList;
