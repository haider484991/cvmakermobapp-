/**
 * ScreenHeader — one header for every sub-screen (v1.11).
 *
 * The app had five different header treatments: some with a bottom border,
 * some without, titles at 17/600, 18/600 and 20/600, and back buttons with
 * different hit areas. This is the single implementation — use it for any
 * pushed screen so navigation feels identical everywhere.
 */

import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { type as typeScale, SCREEN_PADDING } from '@/constants/design';

interface Props {
  title: string;
  /** Optional supporting line under the title. */
  subtitle?: string;
  /** Element rendered on the right (icon buttons etc.). */
  right?: React.ReactNode;
  /** Override the back action (defaults to router.back()). */
  onBack?: () => void;
  /** Hide the back control for root-level screens. */
  hideBack?: boolean;
  /** Hairline under the header. Default true. */
  bordered?: boolean;
  /** Wrap in a SafeAreaView top edge — for screens not already inside one. */
  safeArea?: boolean;
}

export function ScreenHeader({
  title,
  subtitle,
  right,
  onBack,
  hideBack = false,
  bordered = true,
  safeArea = false,
}: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const { hapticEnabled } = useUIStore();

  const handleBack = () => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onBack) onBack();
    else router.back();
  };

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SCREEN_PADDING - 4,
        paddingVertical: 12,
        borderBottomWidth: bordered ? 1 : 0,
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
      }}
    >
      {hideBack ? (
        <View style={{ width: 34 }} />
      ) : (
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{ width: 34, height: 34, alignItems: 'flex-start', justifyContent: 'center' }}
        >
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
      )}

      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={{ ...typeScale.titleSm, color: colors.text }} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ ...typeScale.meta, color: colors.textSecondary, marginTop: 1 }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {/* Mirrors the back button's width so the title stays optically centred. */}
      <View style={{ width: 34, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );

  if (safeArea) {
    return <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }}>{content}</SafeAreaView>;
  }
  return content;
}
