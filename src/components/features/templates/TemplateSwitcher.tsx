/**
 * TemplateSwitcher — horizontal strip of template thumbnails for the
 * resume preview screen. Tap a thumbnail to swap templates instantly —
 * the user sees the live PDF preview re-render with the new design
 * without leaving the screen.
 *
 * This is what competitor apps like Canva and Zety do. The previous flow
 * forced users to navigate to a separate Templates page, lose context, and
 * come back — which most users never did, so they only saw the default.
 */

import React, { useCallback, useRef, useEffect } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Check, Lock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useTemplateStore } from '@/stores/templateStore';
import { ResumeTemplate } from '@/types/template';
import { LayoutThumb } from './LayoutThumb';

const THUMB_W = 96;
const THUMB_H = 132;

export function TemplateSwitcher() {
  const { colors } = useTheme();
  const { hapticEnabled } = useUIStore();
  const { templates, selectedTemplateId, setSelectedTemplate } = useTemplateStore();
  const listRef = useRef<FlatList<ResumeTemplate>>(null);

  // Scroll selected template into view on mount so users see context.
  useEffect(() => {
    const idx = templates.findIndex((t) => t.id === selectedTemplateId);
    if (idx > 0 && listRef.current) {
      const offset = idx * (THUMB_W + 12);
      setTimeout(() => listRef.current?.scrollToOffset({ offset, animated: false }), 50);
    }
  }, []);

  const handlePick = useCallback(
    (t: ResumeTemplate) => {
      if (t.id === selectedTemplateId) return;
      if (hapticEnabled) Haptics.selectionAsync();
      setSelectedTemplate(t.id);
    },
    [hapticEnabled, selectedTemplateId, setSelectedTemplate],
  );

  const renderItem = useCallback(
    ({ item }: { item: ResumeTemplate }) => {
      const isSelected = item.id === selectedTemplateId;
      return (
        <Pressable
          onPress={() => handlePick(item)}
          style={{
            width: THUMB_W,
            marginRight: 12,
          }}
        >
          <View
            style={{
              width: THUMB_W,
              height: THUMB_H,
              borderRadius: 10,
              overflow: 'hidden',
              borderWidth: isSelected ? 2.5 : 1,
              borderColor: isSelected ? colors.primary : colors.border,
              backgroundColor: item.styles.colors.background,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.12,
              shadowRadius: 6,
              elevation: 3,
            }}
          >
            <LayoutThumb template={item} />
            {isSelected && (
              <Animated.View
                entering={FadeIn.duration(180)}
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={12} color="white" strokeWidth={3} />
              </Animated.View>
            )}
            {item.isPremium && !isSelected && (
              <View
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  paddingHorizontal: 5,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: colors.warning,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Lock size={8} color="white" />
                <Text style={{ fontSize: 9, color: 'white', fontWeight: '700' }}>PRO</Text>
              </View>
            )}
          </View>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 11,
              fontWeight: isSelected ? '700' : '500',
              color: isSelected ? colors.primary : colors.text,
              marginTop: 6,
              textAlign: 'center',
            }}
          >
            {item.name}
          </Text>
        </Pressable>
      );
    },
    [colors, handlePick, selectedTemplateId],
  );

  return (
    <View style={{ paddingTop: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, letterSpacing: 0.2 }}>
          Swap template
        </Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary }}>
          {templates.length} designs
        </Text>
      </View>
      <FlatList
        ref={listRef}
        data={templates}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
      />
    </View>
  );
}

export default TemplateSwitcher;
