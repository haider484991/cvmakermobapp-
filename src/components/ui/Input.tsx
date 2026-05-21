import { useState, useId, useCallback } from 'react';
import {
  View,
  TextInput,
  Text,
  TextInputProps,
  Pressable,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Eye, EyeOff } from 'lucide-react-native';
import { getInputA11yProps, MIN_TOUCH_TARGET } from '@/utils/accessibility';
import { ValidationResult } from '@/utils/validation';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
  /**
   * Whether the field is required
   */
  required?: boolean;
  /**
   * Validation function to run on blur
   */
  validate?: (value: string) => ValidationResult;
  /**
   * Whether to validate on change (in addition to blur)
   */
  validateOnChange?: boolean;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  containerStyle,
  isPassword,
  required,
  validate,
  validateOnChange,
  ...props
}: InputProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | undefined>();
  const [hasBeenBlurred, setHasBeenBlurred] = useState(false);

  // Run validation
  const runValidation = useCallback((value: string) => {
    if (validate) {
      const result = validate(value);
      setValidationError(result.isValid ? undefined : result.error);
      return result.isValid;
    }
    return true;
  }, [validate]);

  // Determine which error to show (prop error takes precedence)
  const displayError = error || validationError;

  const getBorderColor = () => {
    if (displayError) return colors.error;
    if (isFocused) return colors.primary;
    return colors.border;
  };

  // Generate accessibility props
  const a11yProps = label
    ? getInputA11yProps(label, {
        hint: hint,
        error: error,
        required: required,
      })
    : {};

  return (
    <View style={containerStyle}>
      {label && (
        <Text
          style={{
            color: colors.text,
            fontSize: 14,
            fontWeight: '500',
            marginBottom: 8,
          }}
          accessibilityRole="text"
        >
          {label}
          {required && (
            <Text style={{ color: colors.error }}> *</Text>
          )}
        </Text>
      )}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: getBorderColor(),
          paddingHorizontal: 16,
          minHeight: MIN_TOUCH_TARGET,
        }}
      >
        {leftIcon && (
          <View
            style={{ marginRight: 12 }}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            {leftIcon}
          </View>
        )}

        <TextInput
          {...props}
          {...a11yProps}
          secureTextEntry={isPassword && !showPassword}
          placeholderTextColor={colors.textMuted}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            setHasBeenBlurred(true);
            // Validate on blur
            if (validate && typeof props.value === 'string') {
              runValidation(props.value);
            }
            props.onBlur?.(e);
          }}
          onChangeText={(text) => {
            // Validate on change if enabled and field has been blurred once
            if (validateOnChange && hasBeenBlurred && validate) {
              runValidation(text);
            }
            props.onChangeText?.(text);
          }}
          style={[
            {
              flex: 1,
              color: colors.text,
              fontSize: 16,
              paddingVertical: 14,
            },
            props.style,
          ]}
        />

        {isPassword ? (
          <Pressable
            onPress={() => setShowPassword(!showPassword)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            accessibilityHint="Double tap to toggle password visibility"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {showPassword ? (
              <EyeOff size={20} color={colors.textMuted} />
            ) : (
              <Eye size={20} color={colors.textMuted} />
            )}
          </Pressable>
        ) : (
          rightIcon && (
            <View
              style={{ marginLeft: 12 }}
              accessible={false}
              importantForAccessibility="no-hide-descendants"
            >
              {rightIcon}
            </View>
          )
        )}
      </View>

      {displayError && (
        <Text
          style={{
            color: colors.error,
            fontSize: 12,
            marginTop: 4,
          }}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {displayError}
        </Text>
      )}

      {hint && !displayError && (
        <Text
          style={{
            color: colors.textMuted,
            fontSize: 12,
            marginTop: 4,
          }}
          accessibilityRole="text"
        >
          {hint}
        </Text>
      )}
    </View>
  );
}
