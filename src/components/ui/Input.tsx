import { useState, useId } from 'react';
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
  ...props
}: InputProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const getBorderColor = () => {
    if (error) return colors.error;
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
            props.onBlur?.(e);
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

      {error && (
        <Text
          style={{
            color: colors.error,
            fontSize: 12,
            marginTop: 4,
          }}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      )}

      {hint && !error && (
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
