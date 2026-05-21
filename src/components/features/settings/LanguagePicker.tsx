/**
 * LanguagePicker — bottom-sheet modal listing every supported locale.
 *
 * Each row shows the native name (so users find their language regardless
 * of what language the app is currently in) + a checkmark on the active
 * one. Tapping a row immediately switches the language and dismisses.
 */

import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, X, Globe } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { SUPPORTED_LOCALES, changeLocale, type SupportedLocale } from '@/i18n';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function LanguagePicker({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const { hapticEnabled } = useUIStore();
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language) as SupportedLocale;

  const select = async (code: SupportedLocale) => {
    if (hapticEnabled) {
      Haptics.selectionAsync();
    }
    if (code !== current) {
      await changeLocale(code);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Globe size={20} color={colors.primary} />
            <Text
              style={{
                fontSize: 18,
                fontWeight: '700',
                color: colors.text,
                marginLeft: 8,
              }}
            >
              {t('profile.language')}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {SUPPORTED_LOCALES.map((loc) => {
            const active = loc.code === current;
            return (
              <Pressable
                key={loc.code}
                onPress={() => select(loc.code)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  backgroundColor: active ? colors.primary + '0F' : 'transparent',
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border + '60',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: active ? '700' : '500',
                      color: active ? colors.primary : colors.text,
                      writingDirection: loc.rtl ? 'rtl' : 'ltr',
                    }}
                  >
                    {loc.nativeName}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: colors.textSecondary,
                      marginTop: 2,
                    }}
                  >
                    {loc.name}
                  </Text>
                </View>
                {active && <Check size={22} color={colors.primary} strokeWidth={3} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default LanguagePicker;
