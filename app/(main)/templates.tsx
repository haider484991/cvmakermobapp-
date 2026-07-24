import { View, Text, Pressable, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn, useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { Star, Lock, Check, Target, ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useTemplateStore } from '@/stores/templateStore';
import { useUIStore } from '@/stores/uiStore';
import { TEMPLATE_CATEGORIES, TemplateCategory, ResumeTemplate } from '@/types/template';
import { useCallback, useMemo, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { NativeAdCard } from '@/components/ads';
import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';
import { usePremium } from '@/hooks/usePremium';
import { PaywallModal } from '@/components/features/paywall/PaywallModal';
import { LayoutThumb } from '@/components/features/templates';
import { useGamification } from '@/hooks/useGamification';

const CATEGORY_FILTERS: Array<{ key: TemplateCategory | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'ats-optimized', label: 'ATS-Optimized' },
  { key: 'professional', label: 'Professional' },
  { key: 'modern', label: 'Modern' },
  { key: 'creative', label: 'Creative' },
  { key: 'minimal', label: 'Minimal' },
];

interface TemplateCardProps {
  template: ResumeTemplate;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}


// Thumbnail renderer lives in @/components/features/templates/LayoutThumb
// (imported above). No template-specific render code in this file anymore.

function TemplateCard({ template, isSelected, onSelect, index }: TemplateCardProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 50).springify()}
      style={[{ width: '48%', marginBottom: 16 }, animatedStyle]}
    >
      <Pressable
        onPress={onSelect}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: colors.surface,
          borderWidth: isSelected ? 2 : 1,
          borderColor: isSelected ? colors.primary : colors.border,
        }}
      >
        {/* Template Preview — larger card with a subtle gradient backdrop
            so each template feels deliberately art-directed instead of
            sitting flat on the page. */}
        <View
          className="h-64 items-center justify-center relative"
          style={{ backgroundColor: template.previewColor + '0F' }}
        >
          {/* Resume Preview */}
          <View
            className="w-36 h-52 rounded-lg overflow-hidden"
            style={{
              backgroundColor: template.styles.colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.18,
              shadowRadius: 10,
              elevation: 6,
            }}
          >
            <LayoutThumb template={template} />
          </View>

          {/* Premium Badge */}
          {template.isPremium && (
            <View
              className="absolute top-2 right-2 px-2 py-1 rounded-full flex-row items-center"
              style={{ backgroundColor: colors.warning }}
            >
              <Lock size={10} color="white" />
              <Text className="text-white text-xs ml-1 font-medium">PRO</Text>
            </View>
          )}

          {/* Selected Checkmark */}
          {isSelected && (
            <Animated.View
              entering={FadeIn.duration(200)}
              className="absolute top-2 left-2 w-6 h-6 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.primary }}
            >
              <Check size={14} color="white" strokeWidth={3} />
            </Animated.View>
          )}
        </View>

        {/* Template Info */}
        <View className="p-3">
          <Text
            className="font-semibold mb-0.5"
            style={{ color: colors.text }}
            numberOfLines={1}
          >
            {template.name}
          </Text>
          <Text
            className="text-xs mb-2"
            style={{ color: colors.textSecondary }}
            numberOfLines={1}
          >
            {template.description}
          </Text>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Target size={12} color={colors.textSecondary} />
              <Text
                className="text-xs ml-1"
                style={{ color: colors.textSecondary }}
              >
                {TEMPLATE_CATEGORIES[template.category].label}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Star
                size={12}
                color={template.atsScore >= 90 ? colors.success : colors.warning}
                fill={template.atsScore >= 90 ? colors.success : colors.warning}
              />
              <Text
                className="text-xs ml-1 font-medium"
                style={{ color: template.atsScore >= 90 ? colors.success : colors.warning }}
              >
                {template.atsScore}%
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Preview sheet shown when a free user taps a Pro template. Instead of an
 * instant paywall (the old "ambush" that sent ~47% of browsers away without
 * ever creating a resume), we show the template large with a clear unlock CTA
 * and an easy escape to free templates — an informed choice, not a wall.
 */
function TemplatePreviewSheet({
  template,
  onClose,
  onUnlock,
  colors,
}: {
  template: ResumeTemplate | null;
  onClose: () => void;
  onUnlock: () => void;
  colors: any;
}) {
  return (
    <Modal
      visible={!!template}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 32,
          }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 18 }} />

          {template && (
            <>
              {/* Large preview */}
              <View style={{ alignItems: 'center', marginBottom: 18 }}>
                <View
                  style={{
                    width: 188,
                    height: 266,
                    borderRadius: 12,
                    overflow: 'hidden',
                    backgroundColor: template.styles.colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.2,
                    shadowRadius: 14,
                    elevation: 8,
                  }}
                >
                  <LayoutThumb template={template} />
                </View>
              </View>

              {/* Title + PRO badge */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 21, fontWeight: '700', color: colors.text, flex: 1 }}>
                  {template.name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.warning, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 }}>
                  <Lock size={11} color="white" />
                  <Text style={{ color: 'white', fontSize: 11, fontWeight: '700', marginLeft: 4 }}>PRO</Text>
                </View>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 18, lineHeight: 18 }}>
                {template.description} · ATS score {template.atsScore}%
              </Text>

              {/* Unlock */}
              <Pressable
                onPress={onUnlock}
                style={{ backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
              >
                <Star size={16} color="white" fill="white" />
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 16, marginLeft: 8 }}>
                  Unlock all Pro templates
                </Text>
              </Pressable>
              <Pressable onPress={onClose} style={{ paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 15 }}>
                  Browse free templates
                </Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function Templates() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { hapticEnabled } = useUIStore();

  const { isPremium } = usePremium();
  const { trackTemplateViewed } = useGamification();
  const [paywallVisible, setPaywallVisible] = useState(false);
  // The Pro template the user is previewing (null = sheet closed). Tapping a
  // locked template opens this sheet instead of an instant paywall.
  const [previewTemplate, setPreviewTemplate] = useState<ResumeTemplate | null>(null);

  const {
    templates,
    selectedTemplateId,
    filterCategory,
    setSelectedTemplate,
    setFilterCategory,
    getTemplatesByCategory,
  } = useTemplateStore();

  // Check if we came from another screen (e.g., export page)
  const isFromExternalFlow = !!returnTo;

  const filteredTemplates = useMemo(() => {
    return getTemplatesByCategory(filterCategory);
  }, [filterCategory, getTemplatesByCategory]);

  // Create render items list with ads inserted after every 5 templates
  const renderItems = useMemo(() => {
    const items: Array<{ type: 'template'; data: ResumeTemplate } | { type: 'ad'; key: string }> = [];

    filteredTemplates.forEach((template, index) => {
      items.push({ type: 'template', data: template });

      // Insert ad after every 5th template (after indices 4, 9, 14, etc.)
      if ((index + 1) % 5 === 0) {
        items.push({ type: 'ad', key: `ad-${index}` });
      }
    });

    // Add ad at the end if less than 5 templates
    if (filteredTemplates.length > 0 && filteredTemplates.length < 5) {
      items.push({ type: 'ad', key: 'ad-end' });
    }

    return items;
  }, [filteredTemplates]);

  const handleSelectCategory = useCallback((category: TemplateCategory | 'all') => {
    if (hapticEnabled) {
      Haptics.selectionAsync();
    }
    setFilterCategory(category);
  }, [hapticEnabled, setFilterCategory]);

  const handleSelectTemplate = useCallback((template: ResumeTemplate) => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Premium gate: instead of ambushing the user with an instant paywall,
    // open a preview sheet so they can SEE the Pro template up close and make
    // an informed choice. The paywall only appears if they tap "Unlock".
    if (template.isPremium && !isPremium) {
      track('premium_template_previewed' as any, { template_id: template.id });
      setPreviewTemplate(template);
      return;
    }
    setSelectedTemplate(template.id);
    // Analytics: which templates win?
    // XP: this was never called, so the "Template Hunter" achievement
    // (view 10 templates) could never unlock.
    trackTemplateViewed();
    track(ANALYTICS_EVENTS.TEMPLATE_SELECTED, {
      template_id: template.id,
      template_name: template.name,
      category: template.category,
      is_premium: template.isPremium,
      ats_score: template.atsScore,
    });

    // If we came from another flow (e.g., export page), navigate back
    if (returnTo) {
      // Small delay to show the selection feedback
      setTimeout(() => {
        router.replace(returnTo as any);
      }, 200);
    }
  }, [hapticEnabled, setSelectedTemplate, returnTo, router, isPremium]);

  const handleBack = useCallback(() => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (returnTo) {
      router.replace(returnTo as any);
    } else {
      router.back();
    }
  }, [hapticEnabled, returnTo, router]);

  const freeCount = templates.filter(t => !t.isPremium).length;
  const premiumCount = templates.filter(t => t.isPremium).length;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header — premium polish: larger display title, "AI POWERED" trust
          pill, descriptive subhead. Matches the editorial feel of the Stitch
          Template Selector design. */}
      <View className="px-6 pt-4 pb-5">
        {isFromExternalFlow ? (
          <View className="flex-row items-center mb-2">
            <Pressable onPress={handleBack} className="mr-3 p-1 -ml-1" hitSlop={8}>
              <ArrowLeft size={24} color={colors.text} />
            </Pressable>
            <View className="flex-1">
              <Text className="text-2xl font-bold" style={{ color: colors.text, letterSpacing: -0.4 }}>
                Choose Template
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }} className="mt-0.5">
                Tap a template to apply it
              </Text>
            </View>
          </View>
        ) : (
          <>
            <View className="flex-row items-center mb-2">
              <View
                className="flex-row items-center px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: colors.primary + '15',
                  borderWidth: 1,
                  borderColor: colors.primary + '25',
                }}
              >
                <Star size={11} color={colors.primary} fill={colors.primary} />
                <Text
                  className="ml-1 font-bold"
                  style={{ color: colors.primary, fontSize: 10, letterSpacing: 1.2 }}
                >
                  {t('templates.premiumBadge')}
                </Text>
              </View>
            </View>
            <Text
              className="font-bold"
              style={{ color: colors.text, fontSize: 32, letterSpacing: -0.6 }}
            >
              {t('templates.title')}
            </Text>
            <Text
              style={{ color: colors.textSecondary, fontSize: 14 }}
              className="mt-2"
            >
              {t('templates.subtitle', { total: templates.length, free: freeCount, premium: premiumCount })}
            </Text>
          </>
        )}
      </View>

      {/* Category Filter — premium pill row with subtle active shadow.
          Visual upgrade only; behavior unchanged. */}
      <View className="mb-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}
        >
          {CATEGORY_FILTERS.map((category) => {
            const isActive = filterCategory === category.key;
            return (
              <Pressable
                key={category.key}
                onPress={() => handleSelectCategory(category.key)}
                className="px-4 py-2.5 rounded-full"
                style={{
                  backgroundColor: isActive ? colors.primary : 'transparent',
                  borderWidth: 1.5,
                  borderColor: isActive ? colors.primary : colors.border,
                  shadowColor: isActive ? colors.primary : 'transparent',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: isActive ? 0.25 : 0,
                  shadowRadius: 6,
                  elevation: isActive ? 3 : 0,
                }}
              >
                <Text
                  style={{
                    color: isActive ? 'white' : colors.text,
                    fontWeight: isActive ? '700' : '500',
                    fontSize: 13,
                    letterSpacing: 0.2,
                  }}
                >
                  {category.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Selected Template Info */}
      {selectedTemplateId && (
        <Animated.View
          entering={FadeIn.duration(200)}
          className="mx-6 mb-4 p-3 rounded-xl flex-row items-center"
          style={{ backgroundColor: colors.primary + '10' }}
        >
          <View
            className="w-8 h-8 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: colors.primary + '20' }}
          >
            <Check size={16} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="font-medium" style={{ color: colors.text }}>
              {templates.find(t => t.id === selectedTemplateId)?.name} selected
            </Text>
            <Text className="text-xs" style={{ color: colors.textSecondary }}>
              Applied to all your resumes
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Template Grid */}
      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        <View className="flex-row flex-wrap justify-between">
          {renderItems.map((item, index) => {
            if (item.type === 'ad') {
              // Full-width Native Ad
              return (
                <View key={item.key} style={{ width: '100%', paddingVertical: 8 }}>
                  <NativeAdCard />
                </View>
              );
            }

            // Template Card
            const template = item.data;
            const templateIndex = filteredTemplates.findIndex(t => t.id === template.id);

            return (
              <TemplateCard
                key={template.id}
                template={template}
                isSelected={selectedTemplateId === template.id}
                onSelect={() => handleSelectTemplate(template)}
                index={templateIndex}
              />
            );
          })}
        </View>

        {/* Empty State */}
        {filteredTemplates.length === 0 && (
          <View className="items-center justify-center py-12">
            <Text style={{ color: colors.textSecondary }}>
              No templates in this category
            </Text>
          </View>
        )}

        {/* Bottom Spacing */}
        <View className="h-8" />
      </ScrollView>

      {/* Pro template preview — replaces the instant paywall on tap. */}
      <TemplatePreviewSheet
        template={previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        onUnlock={() => {
          setPreviewTemplate(null);
          setPaywallVisible(true);
        }}
        colors={colors}
      />

      {/* Paywall — opens from the preview sheet's "Unlock" button. */}
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        trigger="template"
      />
    </SafeAreaView>
  );
}
