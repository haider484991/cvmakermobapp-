/**
 * Resume Import Button Component
 * A styled button for triggering resume file import
 */

import React, { useCallback } from 'react';
import {
  Pressable,
  Text,
  View,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Upload, Check, AlertCircle, FileText } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useResumeImport } from '@/hooks/useResumeImport';
import { gradientColors } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonVariant = 'solid' | 'outline' | 'gradient';

interface ResumeImportButtonProps {
  /** Button size variant */
  size?: ButtonSize;
  /** Button style variant */
  variant?: ButtonVariant;
  /** Button text (default: "Import Resume") */
  label?: string;
  /** Full width button */
  fullWidth?: boolean;
  /** Callback when import succeeds */
  onSuccess?: (resumeId: string) => void;
  /** Callback when import fails */
  onError?: (error: string) => void;
  /** Callback when review modal should open */
  onReviewReady?: () => void;
  /** Disable the button */
  disabled?: boolean;
  /** Additional container styles */
  style?: ViewStyle;
}

export function ResumeImportButton({
  size = 'md',
  variant = 'outline',
  label = 'Import Resume',
  fullWidth = false,
  onSuccess,
  onError,
  onReviewReady,
  disabled = false,
  style,
}: ResumeImportButtonProps) {
  const { colors } = useTheme();
  const { hapticEnabled } = useUIStore();
  const {
    selectAndParse,
    isLoading,
    isSuccess,
    isError,
    error,
    statusMessage,
    isReviewing,
  } = useResumeImport();

  const scale = useSharedValue(1);

  // Animation style
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Press handlers
  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 200 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  }, [scale]);

  // Handle button press
  const handlePress = useCallback(async () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      await selectAndParse();

      if (hapticEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Callback when review is ready
      onReviewReady?.();
    } catch (err) {
      if (hapticEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      const errorMsg = err instanceof Error ? err.message : 'Import failed';
      onError?.(errorMsg);
    }
  }, [hapticEnabled, selectAndParse, onReviewReady, onError]);

  // Notify on review ready state change
  React.useEffect(() => {
    if (isReviewing) {
      onReviewReady?.();
    }
  }, [isReviewing, onReviewReady]);

  // Notify on error
  React.useEffect(() => {
    if (isError && error) {
      onError?.(error);
    }
  }, [isError, error, onError]);

  // Get size-based styles
  const getSizeStyles = useCallback(() => {
    switch (size) {
      case 'sm':
        return {
          paddingVertical: 10,
          paddingHorizontal: 16,
          iconSize: 16,
          fontSize: 14,
          gap: 6,
        };
      case 'lg':
        return {
          paddingVertical: 18,
          paddingHorizontal: 28,
          iconSize: 22,
          fontSize: 18,
          gap: 10,
        };
      default:
        return {
          paddingVertical: 14,
          paddingHorizontal: 22,
          iconSize: 20,
          fontSize: 16,
          gap: 8,
        };
    }
  }, [size]);

  const sizeStyles = getSizeStyles();

  // Determine button content based on state
  const renderContent = () => {
    const textColor = variant === 'outline' ? colors.primary : '#FFFFFF';

    if (isLoading) {
      return (
        <>
          <ActivityIndicator size="small" color={textColor} />
          <Text
            style={{
              color: textColor,
              fontSize: sizeStyles.fontSize,
              fontWeight: '600',
              marginLeft: sizeStyles.gap,
            }}
          >
            {statusMessage || 'Processing...'}
          </Text>
        </>
      );
    }

    if (isSuccess) {
      return (
        <>
          <Check size={sizeStyles.iconSize} color={colors.success} />
          <Text
            style={{
              color: colors.success,
              fontSize: sizeStyles.fontSize,
              fontWeight: '600',
              marginLeft: sizeStyles.gap,
            }}
          >
            Imported!
          </Text>
        </>
      );
    }

    if (isError) {
      return (
        <>
          <AlertCircle size={sizeStyles.iconSize} color={colors.error} />
          <Text
            style={{
              color: colors.error,
              fontSize: sizeStyles.fontSize,
              fontWeight: '600',
              marginLeft: sizeStyles.gap,
            }}
          >
            Try Again
          </Text>
        </>
      );
    }

    return (
      <>
        <Upload size={sizeStyles.iconSize} color={textColor} />
        <Text
          style={{
            color: textColor,
            fontSize: sizeStyles.fontSize,
            fontWeight: '600',
            marginLeft: sizeStyles.gap,
          }}
        >
          {label}
        </Text>
      </>
    );
  };

  // Render gradient variant
  if (variant === 'gradient') {
    return (
      <AnimatedPressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled || isLoading}
        style={[
          animatedStyle,
          {
            opacity: disabled ? 0.5 : 1,
            ...(fullWidth && { width: '100%' }),
          },
          style,
        ]}
      >
        <LinearGradient
          colors={gradientColors.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 12,
            paddingVertical: sizeStyles.paddingVertical,
            paddingHorizontal: sizeStyles.paddingHorizontal,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {renderContent()}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  // Render outline variant
  if (variant === 'outline') {
    return (
      <AnimatedPressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled || isLoading}
        style={[
          animatedStyle,
          {
            backgroundColor: 'transparent',
            borderRadius: 12,
            borderWidth: 2,
            borderColor: disabled || isLoading ? colors.border : colors.primary,
            paddingVertical: sizeStyles.paddingVertical,
            paddingHorizontal: sizeStyles.paddingHorizontal,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: disabled ? 0.5 : 1,
            ...(fullWidth && { width: '100%' }),
          },
          style,
        ]}
      >
        {renderContent()}
      </AnimatedPressable>
    );
  }

  // Render solid variant
  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled || isLoading}
      style={[
        animatedStyle,
        {
          backgroundColor: disabled || isLoading ? colors.border : colors.primary,
          borderRadius: 12,
          paddingVertical: sizeStyles.paddingVertical,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
          ...(fullWidth && { width: '100%' }),
        },
        style,
      ]}
    >
      {renderContent()}
    </AnimatedPressable>
  );
}

/**
 * Compact import card for dashboard
 */
export function ResumeImportCard({
  onPress,
  disabled = false,
  style,
}: {
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const { hapticEnabled } = useUIStore();
  const { isLoading, statusMessage } = useResumeImport();

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  }, [scale]);

  const handlePress = useCallback(() => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  }, [hapticEnabled, onPress]);

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled || isLoading}
      style={[
        animatedStyle,
        {
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
          borderStyle: 'dashed',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: colors.primary + '15',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <FileText size={22} color={colors.primary} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.text,
            fontSize: 16,
            fontWeight: '600',
          }}
        >
          {isLoading ? statusMessage : 'Import Existing Resume'}
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 13,
            marginTop: 2,
          }}
        >
          {isLoading ? 'Please wait...' : 'PDF, DOCX, or Image'}
        </Text>
      </View>
      <Upload size={20} color={colors.textSecondary} />
    </AnimatedPressable>
  );
}

export default ResumeImportButton;
