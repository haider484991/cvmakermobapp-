/**
 * Personalize Screen (onboarding step 2)
 *
 * Asks a few quick questions — name, goal, target role, industry, experience —
 * and ACTUALLY SAVES them to the onboarding profile. Those answers then:
 *   - pre-fill the resume header (name + role),
 *   - seed the AI wizard so there's no blank page,
 *   - choose a sensible default template for the user's industry.
 *
 * (Before v1.9.7 this screen collected all of this and threw it away.)
 */

import { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeInUp,
  FadeInRight,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Layout,
} from 'react-native-reanimated';
import { ChevronLeft, Check } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore, type OnboardingProfile } from '@/stores/uiStore';
import { useTemplateStore } from '@/stores/templateStore';
import { PageIndicator } from '@/components/ui';
import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';
import {
  ONBOARDING_GOALS,
  ONBOARDING_INDUSTRIES,
  ONBOARDING_LEVELS,
  defaultTemplateForProfile,
  type Option,
} from '@/services/onboarding/personalize';
import * as Haptics from 'expo-haptics';

// Animated chip — reused for both the "goal" and "industry" selectors since
// both are simple emoji + label options.
function OptionChip({
  option,
  isSelected,
  onSelect,
  index,
  colors,
}: {
  option: Option;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
  colors: any;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: withTiming(isSelected ? colors.primary : colors.surface, { duration: 200 }),
    borderColor: withTiming(isSelected ? colors.primary : colors.border, { duration: 200 }),
  }));

  return (
    <Animated.View entering={FadeInRight.delay(150 + index * 40).springify()} layout={Layout.springify()}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onSelect();
        }}
        onPressIn={() => { scale.value = withSpring(0.92, { damping: 15, stiffness: 400 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      >
        <Animated.View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 24,
              borderWidth: 1.5,
              gap: 6,
            },
            animatedStyle,
          ]}
        >
          <Text style={{ fontSize: 16 }}>{option.emoji}</Text>
          <Text style={{ fontSize: 15, fontWeight: '500', color: isSelected ? '#FFFFFF' : colors.text }}>
            {option.label}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// Animated card for experience level selection
function ExperienceCard({
  level,
  isSelected,
  onSelect,
  index,
  colors,
}: {
  level: (typeof ONBOARDING_LEVELS)[0];
  isSelected: boolean;
  onSelect: () => void;
  index: number;
  colors: any;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: withSpring(isSelected ? colors.primary : colors.border, { damping: 20 }),
    borderWidth: isSelected ? 2 : 1,
  }));

  const checkScale = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isSelected ? 1 : 0, { damping: 15 }) }],
    opacity: withTiming(isSelected ? 1 : 0, { duration: 150 }),
  }));

  return (
    <Animated.View entering={FadeInUp.delay(300 + index * 80).springify()} layout={Layout.springify()}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onSelect();
        }}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 15, stiffness: 400 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      >
        <Animated.View
          style={[
            { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: colors.surface },
            animatedStyle,
          ]}
        >
          <Text style={{ fontSize: 28, marginRight: 12 }}>{level.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>{level.label}</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>{level.description}</Text>
          </View>
          <Animated.View
            style={[
              { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
              checkScale,
            ]}
          >
            <Check size={16} color="#FFFFFF" strokeWidth={3} />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function SectionLabel({ children, colors }: { children: string; colors: any }) {
  return (
    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 }}>
      {children}
    </Text>
  );
}

export default function Goals() {
  const router = useRouter();
  const { colors } = useTheme();
  const { setOnboardingProfile, onboardingProfile } = useUIStore();
  const { setSelectedTemplate } = useTemplateStore();

  // Seed from any previously-saved answers so going Back doesn't lose input.
  const [firstName, setFirstName] = useState(onboardingProfile.firstName ?? '');
  const [selectedGoal, setSelectedGoal] = useState<string | null>(onboardingProfile.goal ?? null);
  const [jobTitle, setJobTitle] = useState(onboardingProfile.targetRole ?? '');
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(onboardingProfile.industry ?? null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(onboardingProfile.experienceLevel ?? null);

  const buttonScale = useSharedValue(1);
  const buttonAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: buttonScale.value }] }));

  const persist = () => {
    const profile: OnboardingProfile = {
      firstName: firstName.trim() || undefined,
      goal: (selectedGoal as OnboardingProfile['goal']) || undefined,
      targetRole: jobTitle.trim() || undefined,
      industry: selectedIndustry || undefined,
      experienceLevel: (selectedLevel as OnboardingProfile['experienceLevel']) || undefined,
    };
    setOnboardingProfile(profile);
    // Choose a strong, free default template for their industry now, so the
    // editor/preview already looks right when they land there.
    setSelectedTemplate(defaultTemplateForProfile(profile));
    return profile;
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const profile = persist();
    track(ANALYTICS_EVENTS.ONBOARDING_STEP_VIEWED, {
      step: 'personalize_done',
      has_name: !!profile.firstName,
      goal: profile.goal ?? null,
      industry: profile.industry ?? null,
      level: profile.experienceLevel ?? null,
      has_role: !!profile.targetRole,
    });
    router.push('/(onboarding)/complete');
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    persist(); // keep whatever they did enter
    track(ANALYTICS_EVENTS.ONBOARDING_STEP_VIEWED, { step: 'personalize_skipped' });
    router.push('/(onboarding)/complete');
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    persist();
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
          {/* Header */}
          <Animated.View
            entering={FadeIn.delay(80).duration(400)}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}
          >
            <Pressable onPress={handleBack} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingRight: 16 }}>
              <ChevronLeft size={24} color={colors.primary} strokeWidth={2} />
              <Text style={{ color: colors.primary, fontSize: 16, marginLeft: 4 }}>Back</Text>
            </Pressable>
            <PageIndicator totalPages={3} currentPage={1} />
            <Pressable onPress={handleSkip} hitSlop={8} style={{ paddingVertical: 8, paddingLeft: 16 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 15 }}>Skip</Text>
            </Pressable>
          </Animated.View>

          {/* Title */}
          <Animated.View entering={FadeInUp.delay(150).duration(500)}>
            <Text style={{ fontSize: 30, fontWeight: '700', color: colors.text, marginBottom: 8, letterSpacing: -0.5 }}>
              Let's personalize{'\n'}your resume
            </Text>
            <Text style={{ fontSize: 16, color: colors.textSecondary, marginBottom: 28, lineHeight: 24 }}>
              A few quick taps and we'll tailor your templates, AI suggestions, and starting point.
            </Text>
          </Animated.View>

          {/* Name */}
          <Animated.View entering={FadeInUp.delay(200).duration(500)} style={{ marginBottom: 28 }}>
            <SectionLabel colors={colors}>What should we call you?</SectionLabel>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Your first name"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              returnKeyType="done"
              style={{
                padding: 16,
                borderRadius: 14,
                fontSize: 16,
                backgroundColor: colors.surface,
                color: colors.text,
                borderWidth: 1.5,
                borderColor: firstName ? colors.primary : colors.border,
              }}
            />
          </Animated.View>

          {/* Goal */}
          <Animated.View entering={FadeInUp.delay(250).duration(500)} style={{ marginBottom: 28 }}>
            <SectionLabel colors={colors}>What brings you here?</SectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {ONBOARDING_GOALS.map((goal, index) => (
                <OptionChip
                  key={goal.id}
                  option={goal}
                  isSelected={selectedGoal === goal.id}
                  onSelect={() => setSelectedGoal(goal.id)}
                  index={index}
                  colors={colors}
                />
              ))}
            </View>
          </Animated.View>

          {/* Target role */}
          <Animated.View entering={FadeInUp.delay(300).duration(500)} style={{ marginBottom: 28 }}>
            <SectionLabel colors={colors}>What role are you targeting?</SectionLabel>
            <TextInput
              value={jobTitle}
              onChangeText={setJobTitle}
              placeholder="e.g. Software Engineer, Product Manager"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              style={{
                padding: 16,
                borderRadius: 14,
                fontSize: 16,
                backgroundColor: colors.surface,
                color: colors.text,
                borderWidth: 1.5,
                borderColor: jobTitle ? colors.primary : colors.border,
              }}
            />
          </Animated.View>

          {/* Industry */}
          <Animated.View entering={FadeInUp.delay(350).duration(500)} style={{ marginBottom: 28 }}>
            <SectionLabel colors={colors}>Your industry</SectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {ONBOARDING_INDUSTRIES.map((industry, index) => (
                <OptionChip
                  key={industry.id}
                  option={industry}
                  isSelected={selectedIndustry === industry.id}
                  onSelect={() => setSelectedIndustry(industry.id)}
                  index={index}
                  colors={colors}
                />
              ))}
            </View>
          </Animated.View>

          {/* Experience level */}
          <Animated.View entering={FadeInUp.delay(400).duration(500)}>
            <SectionLabel colors={colors}>Experience level</SectionLabel>
            <View style={{ gap: 12 }}>
              {ONBOARDING_LEVELS.map((level, index) => (
                <ExperienceCard
                  key={level.id}
                  level={level}
                  isSelected={selectedLevel === level.id}
                  onSelect={() => setSelectedLevel(level.id)}
                  index={index}
                  colors={colors}
                />
              ))}
            </View>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Continue */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingVertical: 24, backgroundColor: colors.background }}>
        <Animated.View entering={FadeInUp.delay(450).duration(500)} style={buttonAnimatedStyle}>
          <Pressable
            onPress={handleContinue}
            onPressIn={() => { buttonScale.value = withSpring(0.96, { damping: 15, stiffness: 300 }); }}
            onPressOut={() => { buttonScale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
            style={{
              paddingVertical: 18,
              borderRadius: 16,
              alignItems: 'center',
              backgroundColor: colors.primary,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '600' }}>Continue</Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
