import { Pressable, Text, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/utils/cn';
import { getButtonA11yProps, MIN_TOUCH_TARGET } from '@/utils/accessibility';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  /**
   * Accessibility label for screen readers
   */
  accessibilityLabel?: string;
  /**
   * Accessibility hint for screen readers
   */
  accessibilityHint?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  onPress,
  children,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const { hapticEnabled } = useUIStore();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const handlePress = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.();
  };

  const getBackgroundColor = () => {
    if (disabled) return colors.border;
    switch (variant) {
      case 'primary':
        return colors.primary;
      case 'secondary':
        return colors.surfaceSecondary;
      case 'outline':
      case 'ghost':
        return 'transparent';
      case 'danger':
        return colors.error;
      default:
        return colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return colors.textMuted;
    switch (variant) {
      case 'primary':
      case 'danger':
        return 'white';
      case 'secondary':
        return colors.text;
      case 'outline':
      case 'ghost':
        return colors.primary;
      default:
        return 'white';
    }
  };

  const getBorderColor = () => {
    if (variant === 'outline') return colors.primary;
    return 'transparent';
  };

  const getPadding = () => {
    switch (size) {
      case 'sm':
        return { paddingVertical: 8, paddingHorizontal: 16 };
      case 'md':
        return { paddingVertical: 12, paddingHorizontal: 20 };
      case 'lg':
        return { paddingVertical: 16, paddingHorizontal: 24 };
      default:
        return { paddingVertical: 12, paddingHorizontal: 20 };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm':
        return 14;
      case 'md':
        return 16;
      case 'lg':
        return 18;
      default:
        return 16;
    }
  };

  // Get the label text for accessibility
  const labelText = accessibilityLabel || (typeof children === 'string' ? children : undefined);
  const a11yProps = labelText
    ? getButtonA11yProps(loading ? `${labelText}, loading` : labelText, {
        hint: accessibilityHint,
        disabled: disabled || loading,
        busy: loading,
      })
    : {};

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled || loading}
      {...a11yProps}
      style={[
        animatedStyle,
        {
          backgroundColor: getBackgroundColor(),
          borderRadius: 12,
          borderWidth: variant === 'outline' ? 2 : 0,
          borderColor: getBorderColor(),
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          opacity: disabled ? 0.5 : 1,
          minHeight: MIN_TOUCH_TARGET, // Ensure minimum touch target
          ...getPadding(),
          ...(fullWidth && { width: '100%' }),
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <Text
          style={[
            {
              color: getTextColor(),
              fontSize: getFontSize(),
              fontWeight: '600',
            },
            textStyle,
          ]}
        >
          {children}
        </Text>
      )}
    </AnimatedPressable>
  );
}
