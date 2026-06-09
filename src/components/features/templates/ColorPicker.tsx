/**
 * ColorPicker — horizontal swatch row that re-colors the active resume
 * template. The first swatch ("Default") clears the override and returns
 * the template to its designed color; the rest apply a curated premium
 * accent. The choice persists on resume.accentColor and flows into both
 * the WebView preview and the PDF export via generatePremiumHTML.
 */

import React, { useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';

/** Curated, tested premium accents. Each pairs well with neutral body text. */
export const ACCENT_PALETTE: Array<{ name: string; hex: string }> = [
  { name: 'Navy', hex: '#1E3A5F' },
  { name: 'Charcoal', hex: '#1F2937' },
  { name: 'Teal', hex: '#0F766E' },
  { name: 'Forest', hex: '#166534' },
  { name: 'Royal', hex: '#1D4ED8' },
  { name: 'Plum', hex: '#6D28D9' },
  { name: 'Burgundy', hex: '#9F1239' },
  { name: 'Crimson', hex: '#DC2626' },
  { name: 'Brass', hex: '#B08D57' },
  { name: 'Slate', hex: '#475569' },
];

interface Props {
  /** Current override (hex) or undefined for the template default. */
  value?: string;
  onChange: (hex: string | null) => void;
}

export function ColorPicker({ value, onChange }: Props) {
  const { colors } = useTheme();

  const pick = useCallback(
    (hex: string | null) => {
      Haptics.selectionAsync();
      onChange(hex);
    },
    [onChange],
  );

  const norm = (value || '').toLowerCase();

  return (
    <View>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: colors.text,
          marginLeft: 16,
          marginBottom: 8,
        }}
      >
        Accent color
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10, alignItems: 'center' }}
      >
        {/* Default — clears the override */}
        <Pressable onPress={() => pick(null)} style={{ alignItems: 'center' }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              borderWidth: 2,
              borderColor: !value ? colors.primary : colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surface,
            }}
          >
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>↺</Text>
          </View>
        </Pressable>

        {ACCENT_PALETTE.map((c) => {
          const selected = norm === c.hex.toLowerCase();
          return (
            <Pressable key={c.hex} onPress={() => pick(c.hex)} style={{ alignItems: 'center' }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: c.hex,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: selected ? 3 : 0,
                  borderColor: colors.background,
                  shadowColor: c.hex,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: selected ? 0.5 : 0.2,
                  shadowRadius: 4,
                  elevation: selected ? 4 : 1,
                }}
              >
                {selected && <Check size={16} color="white" strokeWidth={3} />}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default ColorPicker;
