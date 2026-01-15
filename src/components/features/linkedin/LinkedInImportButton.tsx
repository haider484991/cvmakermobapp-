/**
 * LinkedIn Import Button Component
 * A branded LinkedIn button for importing profile data
 */

import React, { useState, useCallback } from 'react';
import {
  Pressable,
  Text,
  View,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Alert,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Linkedin, Check, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useLinkedIn } from '@/hooks/useLinkedIn';
import { LinkedInProfile } from '@/types/linkedin';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// LinkedIn Brand Colors
const LINKEDIN_BLUE = '#0A66C2';
const LINKEDIN_BLUE_DARK = '#004182';
const LINKEDIN_BLUE_LIGHT = '#378FE9';

type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonVariant = 'solid' | 'outline';

interface LinkedInImportButtonProps {
  /** Button size variant */
  size?: ButtonSize;
  /** Button style variant */
  variant?: ButtonVariant;
  /** Button text (default: "Import from LinkedIn") */
  label?: string;
  /** Full width button */
  fullWidth?: boolean;
  /** Callback when import succeeds */
  onSuccess?: (profile: LinkedInProfile) => void;
  /** Callback when import fails */
  onError?: (error: string) => void;
  /** Callback when import is cancelled */
  onCancel?: () => void;
  /** Disable the button */
  disabled?: boolean;
  /** Additional container styles */
  style?: ViewStyle;
  /** Additional text styles */
  textStyle?: TextStyle;
  /** Show success state after import */
  showSuccessState?: boolean;
  /** Duration to show success state (ms) */
  successStateDuration?: number;
}

export function LinkedInImportButton({
  size = 'md',
  variant = 'solid',
  label = 'Import from LinkedIn',
  fullWidth = false,
  onSuccess,
  onError,
  onCancel,
  disabled = false,
  style,
  textStyle,
  showSuccessState = true,
  successStateDuration = 2000,
}: LinkedInImportButtonProps) {
  const { colors } = useTheme();
  const { hapticEnabled } = useUIStore();
  const {
    connect,
    isLoading,
    error,
    profile,
    authState,
    isConfigured,
    clearError,
  } = useLinkedIn();

  const [showSuccess, setShowSuccess] = useState(false);
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

    // Check if LinkedIn is configured
    if (!isConfigured) {
      Alert.alert(
        'LinkedIn Not Configured',
        'LinkedIn integration is not set up. Please contact support.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Clear any previous errors
    clearError();

    try {
      const result = await connect();

      if (result.success && profile) {
        if (hapticEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        if (showSuccessState) {
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), successStateDuration);
        }

        onSuccess?.(profile);
      } else if (!result.success) {
        if (result.error?.includes('cancel')) {
          onCancel?.();
        } else {
          if (hapticEnabled) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
          onError?.(result.error || 'Import failed');
        }
      }
    } catch (err) {
      if (hapticEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      const errorMsg = err instanceof Error ? err.message : 'Import failed';
      onError?.(errorMsg);
    }
  }, [
    hapticEnabled,
    isConfigured,
    clearError,
    connect,
    profile,
    showSuccessState,
    successStateDuration,
    onSuccess,
    onCancel,
    onError,
  ]);

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

  // Get variant-based styles
  const getVariantStyles = useCallback(() => {
    const isDisabled = disabled || isLoading;

    if (variant === 'outline') {
      return {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: isDisabled ? colors.border : LINKEDIN_BLUE,
        textColor: isDisabled ? colors.textMuted : LINKEDIN_BLUE,
        iconColor: isDisabled ? colors.textMuted : LINKEDIN_BLUE,
      };
    }

    return {
      backgroundColor: isDisabled ? colors.border : LINKEDIN_BLUE,
      borderWidth: 0,
      borderColor: 'transparent',
      textColor: isDisabled ? colors.textMuted : '#FFFFFF',
      iconColor: isDisabled ? colors.textMuted : '#FFFFFF',
    };
  }, [variant, disabled, isLoading, colors]);

  const variantStyles = getVariantStyles();

  // Determine button content based on state
  const renderContent = () => {
    if (isLoading) {
      return (
        <>
          <ActivityIndicator
            size="small"
            color={variantStyles.textColor}
          />
          <Text
            style={[
              {
                color: variantStyles.textColor,
                fontSize: sizeStyles.fontSize,
                fontWeight: '600',
                marginLeft: sizeStyles.gap,
              },
              textStyle,
            ]}
          >
            {authState.status === 'authenticating'
              ? 'Connecting...'
              : 'Importing...'}
          </Text>
        </>
      );
    }

    if (showSuccess) {
      return (
        <>
          <Check size={sizeStyles.iconSize} color={colors.success} />
          <Text
            style={[
              {
                color: colors.success,
                fontSize: sizeStyles.fontSize,
                fontWeight: '600',
                marginLeft: sizeStyles.gap,
              },
              textStyle,
            ]}
          >
            Imported!
          </Text>
        </>
      );
    }

    if (error) {
      return (
        <>
          <AlertCircle
            size={sizeStyles.iconSize}
            color={variant === 'solid' ? '#FFFFFF' : colors.error}
          />
          <Text
            style={[
              {
                color: variant === 'solid' ? '#FFFFFF' : colors.error,
                fontSize: sizeStyles.fontSize,
                fontWeight: '600',
                marginLeft: sizeStyles.gap,
              },
              textStyle,
            ]}
          >
            Try Again
          </Text>
        </>
      );
    }

    return (
      <>
        <Linkedin size={sizeStyles.iconSize} color={variantStyles.iconColor} />
        <Text
          style={[
            {
              color: variantStyles.textColor,
              fontSize: sizeStyles.fontSize,
              fontWeight: '600',
              marginLeft: sizeStyles.gap,
            },
            textStyle,
          ]}
        >
          {label}
        </Text>
      </>
    );
  };

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled || isLoading}
      style={[
        animatedStyle,
        {
          backgroundColor: variantStyles.backgroundColor,
          borderRadius: 12,
          borderWidth: variantStyles.borderWidth,
          borderColor: variantStyles.borderColor,
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
 * Compact LinkedIn icon button (just the icon)
 */
export function LinkedInIconButton({
  size = 'md',
  onSuccess,
  onError,
  disabled = false,
  style,
}: Omit<LinkedInImportButtonProps, 'variant' | 'label' | 'fullWidth' | 'textStyle'>) {
  const { colors } = useTheme();
  const { hapticEnabled } = useUIStore();
  const { connect, isLoading, profile, isConfigured, clearError } = useLinkedIn();

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 200 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  }, [scale]);

  const handlePress = useCallback(async () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (!isConfigured) {
      Alert.alert(
        'LinkedIn Not Configured',
        'LinkedIn integration is not set up.',
        [{ text: 'OK' }]
      );
      return;
    }

    clearError();

    try {
      const result = await connect();
      if (result.success && profile) {
        onSuccess?.(profile);
      } else if (result.error) {
        onError?.(result.error);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Import failed');
    }
  }, [hapticEnabled, isConfigured, clearError, connect, profile, onSuccess, onError]);

  const iconSize = size === 'sm' ? 20 : size === 'lg' ? 28 : 24;
  const buttonSize = size === 'sm' ? 36 : size === 'lg' ? 52 : 44;

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled || isLoading}
      style={[
        animatedStyle,
        {
          width: buttonSize,
          height: buttonSize,
          borderRadius: buttonSize / 2,
          backgroundColor: LINKEDIN_BLUE,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Linkedin size={iconSize} color="#FFFFFF" />
      )}
    </AnimatedPressable>
  );
}

export default LinkedInImportButton;
