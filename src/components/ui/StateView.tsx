/**
 * StateView — consistent empty / loading / error screens (v1.11).
 *
 * Previously the same "resume missing" condition rendered "Loading..." on one
 * screen and "Resume not found" on another, empty states used an emoji here
 * and an icon there, and only some offered a way out. One component, one
 * treatment, always with a recovery action when we can offer one.
 */

import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { type as typeScale, radius, space, SCREEN_PADDING } from '@/constants/design';

interface Props {
  /** 'loading' shows a spinner; otherwise the icon is shown. */
  variant?: 'empty' | 'error' | 'loading';
  icon?: LucideIcon;
  title: string;
  message?: string;
  /** Primary recovery action — always offer one if a sensible one exists. */
  actionLabel?: string;
  onAction?: () => void;
}

export function StateView({ variant = 'empty', icon: Icon, title, message, actionLabel, onAction }: Props) {
  const { colors } = useTheme();
  const tone = variant === 'error' ? colors.error : colors.textMuted;

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: SCREEN_PADDING + 16,
        paddingVertical: space.xxxl,
      }}
    >
      {variant === 'loading' ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : Icon ? (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.lg,
            backgroundColor: tone + '15',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={30} color={tone} />
        </View>
      ) : null}

      <Text
        style={{
          ...typeScale.heading,
          color: colors.text,
          textAlign: 'center',
          marginTop: space.lg,
        }}
      >
        {title}
      </Text>

      {message ? (
        <Text
          style={{
            ...typeScale.caption,
            color: colors.textSecondary,
            textAlign: 'center',
            marginTop: space.sm,
            lineHeight: 20,
          }}
        >
          {message}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={{
            marginTop: space.xl,
            backgroundColor: colors.primary,
            borderRadius: radius.md,
            paddingHorizontal: space.xxl,
            paddingVertical: space.md,
          }}
        >
          <Text style={{ ...typeScale.strong, color: 'white' }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
