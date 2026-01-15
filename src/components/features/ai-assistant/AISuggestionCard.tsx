import React, { useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withDelay,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated';
import { Sparkles, Check, X, ChevronRight, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { Card } from '@/components/ui/Card';
import { TypewriterText } from '@/components/ui/TypewriterText';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AISuggestionCardProps {
  /**
   * The AI-generated suggestion content
   */
  suggestion: string;

  /**
   * Type of suggestion for styling
   */
  type?: 'summary' | 'bullet' | 'skill' | 'general';

  /**
   * Whether the suggestion is currently loading
   */
  isLoading?: boolean;

  /**
   * Loading message to display
   */
  loadingMessage?: string;

  /**
   * Error state
   */
  error?: {
    message: string;
    retryable?: boolean;
  } | null;

  /**
   * Callback when the suggestion is applied
   */
  onApply?: () => void;

  /**
   * Callback when the suggestion is dismissed
   */
  onDismiss?: () => void;

  /**
   * Callback when retry is clicked (for errors)
   */
  onRetry?: () => void;

  /**
   * Whether the card is dismissable
   */
  dismissable?: boolean;

  /**
   * Optional title for the card
   */
  title?: string;

  /**
   * Whether to show typing animation
   */
  showTypingAnimation?: boolean;

  /**
   * Whether the text is currently streaming (for ChatGPT-like effect)
   */
  isStreaming?: boolean;

  /**
   * Whether to use typewriter effect for the suggestion text
   */
  useTypewriterEffect?: boolean;
}

/**
 * Typing indicator component for loading state
 */
function TypingIndicator() {
  const { colors } = useTheme();
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const animate = () => {
      dot1.value = withSequence(
        withSpring(1, { damping: 10 }),
        withDelay(300, withSpring(0, { damping: 10 }))
      );
      dot2.value = withDelay(
        150,
        withSequence(
          withSpring(1, { damping: 10 }),
          withDelay(300, withSpring(0, { damping: 10 }))
        )
      );
      dot3.value = withDelay(
        300,
        withSequence(
          withSpring(1, { damping: 10 }),
          withDelay(300, withSpring(0, { damping: 10 }))
        )
      );
    };

    animate();
    const interval = setInterval(animate, 1200);
    return () => clearInterval(interval);
  }, [dot1, dot2, dot3]);

  const dotStyle1 = useAnimatedStyle(() => ({
    transform: [{ translateY: -dot1.value * 4 }],
    opacity: 0.5 + dot1.value * 0.5,
  }));

  const dotStyle2 = useAnimatedStyle(() => ({
    transform: [{ translateY: -dot2.value * 4 }],
    opacity: 0.5 + dot2.value * 0.5,
  }));

  const dotStyle3 = useAnimatedStyle(() => ({
    transform: [{ translateY: -dot3.value * 4 }],
    opacity: 0.5 + dot3.value * 0.5,
  }));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Animated.View
        style={[
          {
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.primary,
          },
          dotStyle1,
        ]}
      />
      <Animated.View
        style={[
          {
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.primary,
          },
          dotStyle2,
        ]}
      />
      <Animated.View
        style={[
          {
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.primary,
          },
          dotStyle3,
        ]}
      />
    </View>
  );
}

/**
 * Action button component
 */
interface ActionButtonProps {
  onPress: () => void;
  variant: 'apply' | 'dismiss' | 'retry';
  disabled?: boolean;
}

function ActionButton({ onPress, variant, disabled }: ActionButtonProps) {
  const { colors } = useTheme();
  const { hapticEnabled } = useUIStore();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const handlePress = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getButtonConfig = () => {
    switch (variant) {
      case 'apply':
        return {
          backgroundColor: colors.primary,
          icon: <Check size={18} color="white" />,
          label: 'Apply',
        };
      case 'dismiss':
        return {
          backgroundColor: colors.surfaceSecondary,
          icon: <X size={18} color={colors.textSecondary} />,
          label: 'Dismiss',
        };
      case 'retry':
        return {
          backgroundColor: colors.warning,
          icon: <ChevronRight size={18} color="white" />,
          label: 'Retry',
        };
    }
  };

  const config = getButtonConfig();

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      style={[
        animatedStyle,
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 8,
          backgroundColor: config.backgroundColor,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {config.icon}
      <Text
        style={{
          color: variant === 'dismiss' ? colors.textSecondary : 'white',
          fontSize: 14,
          fontWeight: '600',
        }}
      >
        {config.label}
      </Text>
    </AnimatedPressable>
  );
}

/**
 * AI Suggestion Card component
 *
 * Displays AI-generated suggestions with apply/dismiss actions,
 * loading states with typing indicator, and error handling.
 */
export function AISuggestionCard({
  suggestion,
  type = 'general',
  isLoading = false,
  loadingMessage = 'AI is thinking...',
  error = null,
  onApply,
  onDismiss,
  onRetry,
  dismissable = true,
  title,
  showTypingAnimation = true,
  isStreaming = false,
  useTypewriterEffect = true,
}: AISuggestionCardProps) {
  const { colors, isDark } = useTheme();

  // Card appearance animation
  const cardScale = useSharedValue(0.95);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    cardScale.value = withSpring(1, { damping: 15, stiffness: 100 });
    cardOpacity.value = withSpring(1, { damping: 15, stiffness: 100 });
  }, [cardScale, cardOpacity]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  // Get accent color based on type
  const getAccentColor = () => {
    switch (type) {
      case 'summary':
        return colors.primary;
      case 'bullet':
        return colors.success;
      case 'skill':
        return colors.warning;
      default:
        return colors.primary;
    }
  };

  const accentColor = getAccentColor();

  // Error state
  if (error) {
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={cardAnimatedStyle}
      >
        <Card variant="outlined" padding="md">
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: `${colors.error}15`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertCircle size={20} color={colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.error,
                  marginBottom: 4,
                }}
              >
                Something went wrong
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  lineHeight: 18,
                }}
              >
                {error.message}
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 12,
            }}
          >
            {dismissable && onDismiss && (
              <ActionButton onPress={onDismiss} variant="dismiss" />
            )}
            {error.retryable && onRetry && (
              <ActionButton onPress={onRetry} variant="retry" />
            )}
          </View>
        </Card>
      </Animated.View>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={cardAnimatedStyle}
      >
        <Card variant="outlined" padding="md">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: `${accentColor}15`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {showTypingAnimation ? (
                <TypingIndicator />
              ) : (
                <ActivityIndicator size="small" color={accentColor} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} color={accentColor} />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '500',
                    color: colors.textSecondary,
                  }}
                >
                  {loadingMessage}
                </Text>
              </View>
              {showTypingAnimation && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <TypingIndicator />
                </View>
              )}
            </View>
          </View>
        </Card>
      </Animated.View>
    );
  }

  // Content state
  return (
    <Animated.View
      entering={SlideInRight.duration(300).springify()}
      exiting={SlideOutLeft.duration(200)}
      style={cardAnimatedStyle}
    >
      <Card variant="elevated" padding="md">
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: `${accentColor}15`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={16} color={accentColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: accentColor,
              }}
            >
              {title || 'AI Suggestion'}
            </Text>
          </View>
        </View>

        {/* Suggestion content */}
        <View
          style={{
            backgroundColor: isDark ? colors.surfaceSecondary : colors.background,
            borderRadius: 10,
            padding: 12,
            marginBottom: 12,
            borderLeftWidth: 3,
            borderLeftColor: accentColor,
          }}
        >
          {useTypewriterEffect || isStreaming ? (
            <TypewriterText
              text={suggestion}
              isStreaming={isStreaming}
              style={{
                fontSize: 14,
                color: colors.text,
                lineHeight: 20,
              }}
              showCursor={isStreaming}
              delay={20}
            />
          ) : (
            <Text
              style={{
                fontSize: 14,
                color: colors.text,
                lineHeight: 20,
              }}
            >
              {suggestion}
            </Text>
          )}
        </View>

        {/* Actions */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          {dismissable && onDismiss && (
            <ActionButton onPress={onDismiss} variant="dismiss" />
          )}
          {onApply && <ActionButton onPress={onApply} variant="apply" />}
        </View>
      </Card>
    </Animated.View>
  );
}

export default AISuggestionCard;
