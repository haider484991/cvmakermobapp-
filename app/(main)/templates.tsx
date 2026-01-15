import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn, useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { Star, Lock, Check, Target, ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTemplateStore } from '@/stores/templateStore';
import { useUIStore } from '@/stores/uiStore';
import { TEMPLATE_CATEGORIES, TemplateCategory, ResumeTemplate } from '@/types/template';
import { useCallback, useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { NativeAdCard } from '@/components/ads';

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

// Different layout renderers for unique template previews
const renderClassicLayout = (styles: ResumeTemplate['styles']) => (
  <View style={{ flex: 1 }}>
    {/* Classic Header */}
    <View className="px-2 pt-2 pb-1 items-center" style={{ borderBottomWidth: 0.5, borderBottomColor: styles.colors.border }}>
      <Text className="font-bold" style={{ fontSize: 7, color: styles.colors.text }}>John Doe</Text>
      <Text style={{ fontSize: 5, color: styles.colors.primary }}>Software Engineer</Text>
      <Text style={{ fontSize: 3.5, color: styles.colors.textLight }}>john@email.com • (555) 123-4567</Text>
    </View>
    {/* Content */}
    <View className="px-2 py-1 flex-1">
      <View className="mb-1">
        <Text className="font-bold uppercase" style={{ fontSize: 4, color: styles.colors.primary, borderBottomWidth: 0.5, borderBottomColor: styles.colors.primary }}>Experience</Text>
        <Text className="font-semibold" style={{ fontSize: 4, color: styles.colors.text }}>Senior Developer</Text>
        <Text style={{ fontSize: 3.5, color: styles.colors.textLight }}>Tech Corp • 2020-Present</Text>
      </View>
      <View>
        <Text className="font-bold uppercase" style={{ fontSize: 4, color: styles.colors.primary, borderBottomWidth: 0.5, borderBottomColor: styles.colors.primary }}>Skills</Text>
        <View className="flex-row flex-wrap gap-0.5 mt-0.5">
          {['React', 'Node', 'TypeScript'].map((s, i) => (
            <View key={i} className="rounded-sm px-1" style={{ backgroundColor: styles.colors.primary + '15' }}>
              <Text style={{ fontSize: 3.5, color: styles.colors.primary }}>{s}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  </View>
);

const renderSidebarLayout = (styles: ResumeTemplate['styles'], sidebarColor: string) => (
  <View className="flex-row flex-1">
    {/* Sidebar */}
    <View className="w-10" style={{ backgroundColor: sidebarColor }}>
      <View className="items-center pt-2 pb-1">
        <View className="w-6 h-6 rounded-full bg-white/30 items-center justify-center mb-1">
          <Text style={{ fontSize: 5, color: 'white', fontWeight: 'bold' }}>JD</Text>
        </View>
        <Text className="font-bold text-center" style={{ fontSize: 4, color: 'white' }}>John</Text>
        <Text className="text-center" style={{ fontSize: 4, color: 'white' }}>Doe</Text>
      </View>
      <View className="px-1 mt-1">
        <Text className="font-bold uppercase" style={{ fontSize: 3, color: 'rgba(255,255,255,0.8)' }}>Skills</Text>
        {['React', 'Node', 'Python'].map((s, i) => (
          <Text key={i} style={{ fontSize: 3, color: 'white', marginTop: 1 }}>• {s}</Text>
        ))}
      </View>
    </View>
    {/* Main Content */}
    <View className="flex-1 px-1.5 py-1.5">
      <Text className="font-bold" style={{ fontSize: 5, color: styles.colors.primary }}>Software Engineer</Text>
      <Text style={{ fontSize: 3, color: styles.colors.textLight, marginBottom: 2 }}>john@email.com</Text>
      <Text className="font-bold uppercase" style={{ fontSize: 3.5, color: styles.colors.primary }}>Experience</Text>
      <Text className="font-semibold" style={{ fontSize: 3.5, color: styles.colors.text }}>Senior Developer</Text>
      <Text style={{ fontSize: 3, color: styles.colors.textLight }}>Tech Corp • 2020-Now</Text>
      <Text className="font-bold uppercase mt-1" style={{ fontSize: 3.5, color: styles.colors.primary }}>Education</Text>
      <Text style={{ fontSize: 3, color: styles.colors.text }}>BS Computer Science</Text>
    </View>
  </View>
);

const renderBannerLayout = (styles: ResumeTemplate['styles']) => (
  <View style={{ flex: 1 }}>
    {/* Banner Header */}
    <View className="px-2 py-2" style={{ backgroundColor: styles.colors.primary }}>
      <Text className="font-bold" style={{ fontSize: 7, color: 'white' }}>John Doe</Text>
      <Text style={{ fontSize: 5, color: 'rgba(255,255,255,0.9)' }}>Software Engineer</Text>
    </View>
    {/* Content */}
    <View className="px-2 py-1 flex-1">
      <View className="flex-row gap-1 mb-1">
        <Text style={{ fontSize: 3, color: styles.colors.textLight }}>📧 john@email.com</Text>
        <Text style={{ fontSize: 3, color: styles.colors.textLight }}>📱 555-1234</Text>
      </View>
      <Text className="font-bold" style={{ fontSize: 4, color: styles.colors.primary }}>EXPERIENCE</Text>
      <Text className="font-semibold" style={{ fontSize: 3.5, color: styles.colors.text }}>Senior Developer at Tech Corp</Text>
      <Text style={{ fontSize: 3, color: styles.colors.textLight }}>Building scalable web applications</Text>
      <View className="flex-row flex-wrap gap-0.5 mt-1">
        {['React', 'AWS', 'Node'].map((s, i) => (
          <View key={i} className="rounded px-1" style={{ backgroundColor: styles.colors.primary + '20' }}>
            <Text style={{ fontSize: 3, color: styles.colors.primary }}>{s}</Text>
          </View>
        ))}
      </View>
    </View>
  </View>
);

const renderModernLayout = (styles: ResumeTemplate['styles']) => (
  <View style={{ flex: 1, backgroundColor: styles.colors.background }}>
    {/* Modern Header with accent line */}
    <View className="px-2 pt-2 pb-1">
      <View className="flex-row items-center">
        <View className="w-1 h-8 rounded-full mr-1.5" style={{ backgroundColor: styles.colors.primary }} />
        <View>
          <Text className="font-bold" style={{ fontSize: 7, color: styles.colors.text }}>John Doe</Text>
          <Text style={{ fontSize: 5, color: styles.colors.primary }}>Software Engineer</Text>
        </View>
      </View>
    </View>
    {/* Two Column Content */}
    <View className="flex-row px-2 py-1 flex-1">
      <View className="flex-1 pr-1">
        <Text className="font-bold uppercase" style={{ fontSize: 3.5, color: styles.colors.primary, marginBottom: 1 }}>Experience</Text>
        <Text className="font-semibold" style={{ fontSize: 3.5, color: styles.colors.text }}>Senior Dev</Text>
        <Text style={{ fontSize: 3, color: styles.colors.textLight }}>Tech Corp</Text>
        <Text style={{ fontSize: 3, color: styles.colors.textLight }}>2020 - Present</Text>
      </View>
      <View className="flex-1 pl-1" style={{ borderLeftWidth: 0.5, borderLeftColor: styles.colors.border }}>
        <Text className="font-bold uppercase" style={{ fontSize: 3.5, color: styles.colors.primary, marginBottom: 1 }}>Skills</Text>
        {['React', 'TypeScript', 'Node.js', 'AWS'].map((s, i) => (
          <View key={i} className="flex-row items-center mb-0.5">
            <View className="w-1 h-1 rounded-full mr-1" style={{ backgroundColor: styles.colors.primary }} />
            <Text style={{ fontSize: 3, color: styles.colors.text }}>{s}</Text>
          </View>
        ))}
      </View>
    </View>
  </View>
);

const renderMinimalLayout = (styles: ResumeTemplate['styles']) => (
  <View style={{ flex: 1, backgroundColor: styles.colors.background }}>
    {/* Ultra Minimal Header */}
    <View className="px-3 pt-3 pb-1">
      <Text className="font-bold" style={{ fontSize: 8, color: styles.colors.text, letterSpacing: 1 }}>JOHN DOE</Text>
      <Text style={{ fontSize: 4, color: styles.colors.textLight, letterSpacing: 0.5 }}>Software Engineer</Text>
    </View>
    {/* Minimal Content */}
    <View className="px-3 py-1 flex-1">
      <View className="mb-2">
        <Text style={{ fontSize: 3.5, color: styles.colors.primary, fontWeight: '600' }}>EXPERIENCE</Text>
        <View className="h-px my-0.5" style={{ backgroundColor: styles.colors.border }} />
        <Text style={{ fontSize: 3.5, color: styles.colors.text }}>Senior Developer</Text>
        <Text style={{ fontSize: 3, color: styles.colors.textLight }}>Tech Corp, 2020—</Text>
      </View>
      <View>
        <Text style={{ fontSize: 3.5, color: styles.colors.primary, fontWeight: '600' }}>SKILLS</Text>
        <View className="h-px my-0.5" style={{ backgroundColor: styles.colors.border }} />
        <Text style={{ fontSize: 3, color: styles.colors.text }}>React • Node • Python • AWS</Text>
      </View>
    </View>
  </View>
);

const renderCreativeLayout = (styles: ResumeTemplate['styles']) => (
  <View style={{ flex: 1, backgroundColor: styles.colors.background }}>
    {/* Creative diagonal header */}
    <View style={{ backgroundColor: styles.colors.primary, height: 28, position: 'relative' }}>
      <View className="absolute bottom-0 left-0 right-0 h-2" style={{ backgroundColor: styles.colors.background, borderTopLeftRadius: 100 }} />
      <View className="px-2 pt-1">
        <Text className="font-bold" style={{ fontSize: 6, color: 'white' }}>John Doe</Text>
        <Text style={{ fontSize: 4, color: 'rgba(255,255,255,0.8)' }}>Creative Developer</Text>
      </View>
    </View>
    {/* Creative Content */}
    <View className="px-2 py-1 flex-1">
      <View className="flex-row flex-wrap gap-1 mb-1.5">
        {['UI/UX', 'React', 'Figma'].map((s, i) => (
          <View key={i} className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: styles.colors.primary }}>
            <Text style={{ fontSize: 3, color: 'white' }}>{s}</Text>
          </View>
        ))}
      </View>
      <View className="rounded-lg p-1" style={{ backgroundColor: styles.colors.primary + '10' }}>
        <Text className="font-bold" style={{ fontSize: 3.5, color: styles.colors.primary }}>Latest Work</Text>
        <Text style={{ fontSize: 3, color: styles.colors.text }}>Lead Designer @ Studio</Text>
        <Text style={{ fontSize: 2.5, color: styles.colors.textLight }}>Creating beautiful experiences</Text>
      </View>
    </View>
  </View>
);

const renderExecutiveLayout = (styles: ResumeTemplate['styles']) => (
  <View style={{ flex: 1, backgroundColor: styles.colors.background }}>
    {/* Executive Header with border */}
    <View className="px-2 pt-2 pb-1 mx-2 mt-1" style={{ borderBottomWidth: 1, borderBottomColor: styles.colors.primary }}>
      <Text className="font-bold text-center" style={{ fontSize: 7, color: styles.colors.text, letterSpacing: 0.5 }}>JOHN DOE</Text>
      <Text className="text-center" style={{ fontSize: 4, color: styles.colors.primary }}>Chief Technology Officer</Text>
      <Text className="text-center" style={{ fontSize: 3, color: styles.colors.textLight }}>New York, NY • john@executive.com</Text>
    </View>
    {/* Executive Content */}
    <View className="px-2 py-1 flex-1">
      <Text className="font-bold" style={{ fontSize: 3.5, color: styles.colors.primary, letterSpacing: 0.5 }}>EXECUTIVE SUMMARY</Text>
      <Text style={{ fontSize: 3, color: styles.colors.text, marginTop: 1 }}>15+ years leading technology teams...</Text>
      <Text className="font-bold mt-1.5" style={{ fontSize: 3.5, color: styles.colors.primary, letterSpacing: 0.5 }}>LEADERSHIP</Text>
      <Text style={{ fontSize: 3, color: styles.colors.text, marginTop: 1 }}>VP Engineering • Tech Giants Inc</Text>
    </View>
  </View>
);

const renderTwoColumnLayout = (styles: ResumeTemplate['styles']) => (
  <View className="flex-row flex-1">
    {/* Left Column */}
    <View className="w-12 px-1 py-1.5" style={{ backgroundColor: styles.colors.primary + '08' }}>
      <View className="w-8 h-8 rounded-full self-center mb-1 items-center justify-center" style={{ backgroundColor: styles.colors.primary }}>
        <Text style={{ fontSize: 6, color: 'white', fontWeight: 'bold' }}>JD</Text>
      </View>
      <Text className="font-bold uppercase text-center" style={{ fontSize: 3, color: styles.colors.primary }}>Contact</Text>
      <Text className="text-center" style={{ fontSize: 2.5, color: styles.colors.textLight }}>john@email.com</Text>
      <Text className="text-center" style={{ fontSize: 2.5, color: styles.colors.textLight }}>NYC, USA</Text>
      <Text className="font-bold uppercase text-center mt-1" style={{ fontSize: 3, color: styles.colors.primary }}>Skills</Text>
      {['React', 'Node', 'AWS'].map((s, i) => (
        <Text key={i} className="text-center" style={{ fontSize: 2.5, color: styles.colors.text }}>{s}</Text>
      ))}
    </View>
    {/* Right Column */}
    <View className="flex-1 px-1.5 py-1.5">
      <Text className="font-bold" style={{ fontSize: 6, color: styles.colors.text }}>John Doe</Text>
      <Text style={{ fontSize: 4, color: styles.colors.primary }}>Full Stack Developer</Text>
      <View className="h-px my-1" style={{ backgroundColor: styles.colors.border }} />
      <Text className="font-bold uppercase" style={{ fontSize: 3, color: styles.colors.primary }}>Experience</Text>
      <Text className="font-semibold" style={{ fontSize: 3.5, color: styles.colors.text }}>Senior Developer</Text>
      <Text style={{ fontSize: 3, color: styles.colors.textLight }}>Tech Corp • 2020-Now</Text>
    </View>
  </View>
);

const renderTimelineLayout = (styles: ResumeTemplate['styles']) => (
  <View style={{ flex: 1, backgroundColor: styles.colors.background }}>
    {/* Header */}
    <View className="px-2 pt-2 pb-1 flex-row items-center">
      <View className="w-7 h-7 rounded-lg mr-1.5 items-center justify-center" style={{ backgroundColor: styles.colors.primary }}>
        <Text style={{ fontSize: 5, color: 'white', fontWeight: 'bold' }}>JD</Text>
      </View>
      <View>
        <Text className="font-bold" style={{ fontSize: 6, color: styles.colors.text }}>John Doe</Text>
        <Text style={{ fontSize: 4, color: styles.colors.primary }}>Developer</Text>
      </View>
    </View>
    {/* Timeline Content */}
    <View className="px-2 py-1 flex-1">
      <View className="flex-row">
        <View className="w-0.5 mr-1.5" style={{ backgroundColor: styles.colors.primary }} />
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
            <View className="w-1.5 h-1.5 rounded-full mr-1 -ml-2" style={{ backgroundColor: styles.colors.primary }} />
            <Text className="font-bold" style={{ fontSize: 3.5, color: styles.colors.text }}>Senior Dev</Text>
          </View>
          <Text style={{ fontSize: 3, color: styles.colors.textLight, marginLeft: 0 }}>Tech Corp • 2020</Text>
          <View className="flex-row items-center mb-1 mt-1.5">
            <View className="w-1.5 h-1.5 rounded-full mr-1 -ml-2" style={{ backgroundColor: styles.colors.primary + '60' }} />
            <Text className="font-bold" style={{ fontSize: 3.5, color: styles.colors.text }}>Developer</Text>
          </View>
          <Text style={{ fontSize: 3, color: styles.colors.textLight }}>StartUp • 2018</Text>
        </View>
      </View>
    </View>
  </View>
);

const renderCompactLayout = (styles: ResumeTemplate['styles']) => (
  <View style={{ flex: 1, backgroundColor: styles.colors.background }}>
    {/* Compact Header */}
    <View className="flex-row px-2 pt-2 pb-1 items-center justify-between" style={{ borderBottomWidth: 0.5, borderBottomColor: styles.colors.border }}>
      <View>
        <Text className="font-bold" style={{ fontSize: 6, color: styles.colors.text }}>John Doe</Text>
        <Text style={{ fontSize: 4, color: styles.colors.primary }}>Full Stack Dev</Text>
      </View>
      <View className="items-end">
        <Text style={{ fontSize: 3, color: styles.colors.textLight }}>john@email.com</Text>
        <Text style={{ fontSize: 3, color: styles.colors.textLight }}>NYC, USA</Text>
      </View>
    </View>
    {/* Compact Two Column */}
    <View className="flex-row px-2 py-1 flex-1">
      <View className="flex-1 pr-1">
        <Text className="font-bold" style={{ fontSize: 3.5, color: styles.colors.primary }}>WORK</Text>
        <Text style={{ fontSize: 3, color: styles.colors.text }}>Senior Dev</Text>
        <Text style={{ fontSize: 2.5, color: styles.colors.textLight }}>Tech Corp</Text>
        <Text className="font-bold mt-1" style={{ fontSize: 3.5, color: styles.colors.primary }}>EDUCATION</Text>
        <Text style={{ fontSize: 3, color: styles.colors.text }}>BS in CS</Text>
      </View>
      <View className="flex-1 pl-1">
        <Text className="font-bold" style={{ fontSize: 3.5, color: styles.colors.primary }}>SKILLS</Text>
        <Text style={{ fontSize: 3, color: styles.colors.text }}>React, Node</Text>
        <Text style={{ fontSize: 3, color: styles.colors.text }}>Python, AWS</Text>
        <Text style={{ fontSize: 3, color: styles.colors.text }}>TypeScript</Text>
      </View>
    </View>
  </View>
);

// Map template IDs to their unique layouts
const getTemplateLayout = (template: ResumeTemplate) => {
  const { styles } = template;

  switch (template.id) {
    case 'ats-classic':
      return renderClassicLayout(styles);
    case 'ats-professional':
      return renderBannerLayout(styles);
    case 'executive':
      return renderExecutiveLayout(styles);
    case 'corporate-blue':
      return renderSidebarLayout(styles, styles.colors.primary);
    case 'modern-tech':
      return renderModernLayout(styles);
    case 'sleek-gradient':
      return renderTwoColumnLayout(styles);
    case 'creative-bold':
      return renderCreativeLayout(styles);
    case 'designer-pink':
      return renderTimelineLayout(styles);
    case 'minimal-clean':
      return renderMinimalLayout(styles);
    case 'swiss-style':
      return renderCompactLayout(styles);
    default:
      return renderClassicLayout(styles);
  }
};

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
        {/* Template Preview - Unique Layout for Each */}
        <View
          className="h-56 items-center justify-center relative"
          style={{ backgroundColor: template.previewColor + '08' }}
        >
          {/* Resume Preview */}
          <View
            className="w-32 h-44 rounded-lg overflow-hidden"
            style={{
              backgroundColor: template.styles.colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            {getTemplateLayout(template)}
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

export default function Templates() {
  const { colors } = useTheme();
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { hapticEnabled } = useUIStore();

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
    setSelectedTemplate(template.id);

    // If we came from another flow (e.g., export page), navigate back
    if (returnTo) {
      // Small delay to show the selection feedback
      setTimeout(() => {
        router.replace(returnTo as any);
      }, 200);
    }
  }, [hapticEnabled, setSelectedTemplate, returnTo, router]);

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
      {/* Header */}
      <View className="px-6 pt-4 pb-4">
        {isFromExternalFlow ? (
          <View className="flex-row items-center mb-2">
            <Pressable onPress={handleBack} className="mr-3 p-1 -ml-1">
              <ArrowLeft size={24} color={colors.text} />
            </Pressable>
            <View>
              <Text className="text-2xl font-bold" style={{ color: colors.text }}>
                Choose Template
              </Text>
              <Text style={{ color: colors.textSecondary }} className="text-sm">
                Select a template and go back
              </Text>
            </View>
          </View>
        ) : (
          <>
            <Text className="text-3xl font-bold" style={{ color: colors.text }}>
              Templates
            </Text>
            <Text style={{ color: colors.textSecondary }} className="mt-1">
              {freeCount} free, {premiumCount} premium templates
            </Text>
          </>
        )}
      </View>

      {/* Category Filter */}
      <View className="mb-4">
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
                className="px-4 py-2 rounded-full"
                style={{
                  backgroundColor: isActive ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: isActive ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    color: isActive ? 'white' : colors.text,
                    fontWeight: isActive ? '600' : '400',
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
    </SafeAreaView>
  );
}
