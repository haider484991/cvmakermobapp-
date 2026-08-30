/**
 * Path Picker (onboarding step 3 — the "aha" hand-off)
 *
 * The old "complete" screen was a dead end: a confetti burst, three fake
 * stats, and a button to an empty dashboard. This replaces it with the most
 * important moment in the funnel — choosing HOW to build, then dropping the
 * user straight into that flow with their onboarding answers already applied:
 *
 *   • Build with AI   → AI wizard, pre-seeded from their role/industry
 *   • I have a resume → import a PDF/Word doc, we fill it in
 *   • Start from a template → a new resume with their name + role pre-filled
 *
 * Onboarding is marked complete the moment a path is chosen (or an import is
 * confirmed), so ONBOARDING_COMPLETED finally fires and the funnel is visible.
 */

import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { Sparkles, Upload, FileText, ArrowRight } from 'lucide-react-native';
import { ActivityIndicator } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useResumeImport } from '@/hooks/useResumeImport';
import { ImportReviewModal } from '@/components/features/import';
import { Confetti, PageIndicator } from '@/components/ui';
import { useTranslation } from 'react-i18next';
import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';
import { greetingName } from '@/services/onboarding/personalize';
import * as Haptics from 'expo-haptics';
import { gradientColors } from '@/constants/theme';

type PathCardProps = {
  icon: any;
  title: string;
  subtitle: string;
  onPress: () => void;
  colors: any;
  recommended?: boolean;
  /** Already-translated badge text; PathCard sits above the t() call site. */
  recommendedLabel?: string;
  loading?: boolean;
  delay: number;
  variant?: 'gradient' | 'surface';
};

function PathCard({ icon: Icon, title, subtitle, onPress, colors, recommended, recommendedLabel, loading, delay, variant = 'surface' }: PathCardProps) {
  const isGradient = variant === 'gradient';
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }}>
      <View
        style={{
          width: 50,
          height: 50,
          borderRadius: 15,
          backgroundColor: isGradient ? 'rgba(255,255,255,0.22)' : colors.primary + '15',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        }}
      >
        {loading ? (
          <ActivityIndicator color={isGradient ? 'white' : colors.primary} />
        ) : (
          <Icon size={24} color={isGradient ? 'white' : colors.primary} strokeWidth={2.4} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: isGradient ? 'white' : colors.text }}>{title}</Text>
          {recommended && (
            <View style={{ marginLeft: 8, backgroundColor: isGradient ? 'rgba(255,255,255,0.25)' : colors.success + '20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: isGradient ? 'white' : colors.success, letterSpacing: 0.5 }}>{recommendedLabel}</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 13, color: isGradient ? 'rgba(255,255,255,0.92)' : colors.textSecondary, marginTop: 3, lineHeight: 18 }}>
          {subtitle}
        </Text>
      </View>
      <ArrowRight size={20} color={isGradient ? 'white' : colors.textSecondary} />
    </View>
  );

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(500).springify()}>
      <Pressable onPress={onPress} disabled={loading} style={{ borderRadius: 18, overflow: 'hidden', opacity: loading ? 0.8 : 1 }}>
        {isGradient ? (
          <LinearGradient colors={gradientColors.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            {body}
          </LinearGradient>
        ) : (
          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>{body}</View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function PathPicker() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { setOnboardingCompleted, setOnboardingProfile, onboardingProfile } = useUIStore();
  const { createResume, updateHeader, setActiveResume } = useResumeStore();
  const { selectAndParse, isLoading: isImporting, isReviewing } = useResumeImport();

  const [showConfetti, setShowConfetti] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const name = greetingName(onboardingProfile);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowConfetti(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 350);
    track(ANALYTICS_EVENTS.ONBOARDING_STEP_VIEWED, { step: 'path_picker' });
    return () => clearTimeout(timer);
  }, []);

  // Open the review modal once the parser finishes.
  useEffect(() => {
    if (isReviewing) setShowImportModal(true);
  }, [isReviewing]);

  // Marks onboarding done + records the chosen path. Called when a path is
  // committed (AI / template immediately; import on confirm).
  const finishOnboarding = (path: 'ai' | 'import' | 'template') => {
    setOnboardingCompleted(true);
    setOnboardingProfile({ completedAt: Date.now() });
    track(ANALYTICS_EVENTS.ONBOARDING_PATH_CHOSEN, { path });
    track(ANALYTICS_EVENTS.ONBOARDING_COMPLETED, {
      path,
      goal: onboardingProfile.goal ?? null,
      industry: onboardingProfile.industry ?? null,
      level: onboardingProfile.experienceLevel ?? null,
      has_name: !!onboardingProfile.firstName,
      has_role: !!onboardingProfile.targetRole,
    });
  };

  const handleAI = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    finishOnboarding('ai');
    router.replace('/resume/ai-wizard');
  };

  const handleImport = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await selectAndParse();
    } catch {
      Alert.alert(t('onboarding.welcome.importFailedTitle'), t('onboarding.welcome.importFailed'), [
        { text: t('common.ok') },
      ]);
    }
  };

  const handleImportConfirmed = (resumeId: string) => {
    setShowImportModal(false);
    finishOnboarding('import');
    router.replace(`/resume/${resumeId}`);
  };

  const handleTemplate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const role = onboardingProfile.targetRole?.trim();
    const id = createResume(
      role ? t('onboarding.complete.resumeNameWithRole', { role }) : t('onboarding.complete.resumeName'),
    );
    // Pre-fill the header from onboarding so the very first thing they see is
    // their own name on the page — the difference between "a tool" and "my
    // resume". The default template was already chosen on the previous screen.
    updateHeader(id, {
      fullName: onboardingProfile.firstName?.trim() || '',
      jobTitle: role || '',
    });
    setActiveResume(id);
    finishOnboarding('template');
    router.replace(`/resume/${id}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Confetti active={showConfetti} count={50} duration={3500} onComplete={() => setShowConfetti(false)} />

      <View style={{ flexDirection: 'row', justifyContent: 'center', paddingTop: 16, marginBottom: 8 }}>
        <PageIndicator totalPages={3} currentPage={2} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, flexGrow: 1, justifyContent: 'center' }} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <Animated.View entering={FadeInUp.delay(150).duration(600)} style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -0.5 }}>
            {name
              ? t('onboarding.complete.greetingNamed', { name })
              : t('onboarding.complete.greeting')}
            🎉
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(250).duration(600)} style={{ marginBottom: 28 }}>
          <Text style={{ fontSize: 17, color: colors.textSecondary, lineHeight: 24 }}>
            {t('onboarding.complete.subtitle')}
          </Text>
        </Animated.View>

        {/* Paths */}
        <View style={{ gap: 14 }}>
          <PathCard
            icon={Sparkles}
            title={t('onboarding.complete.pathAI.title')}
            subtitle={t('onboarding.complete.pathAI.subtitle')}
            onPress={handleAI}
            colors={colors}
            recommended
            recommendedLabel={t('onboarding.complete.recommended')}
            variant="gradient"
            delay={350}
          />
          <PathCard
            icon={Upload}
            title={t('onboarding.complete.pathImport.title')}
            subtitle={
              isImporting
                ? t('onboarding.welcome.importing')
                : t('onboarding.complete.pathImport.subtitle')
            }
            onPress={handleImport}
            colors={colors}
            loading={isImporting}
            delay={430}
          />
          <PathCard
            icon={FileText}
            title={t('onboarding.complete.pathTemplate.title')}
            subtitle={t('onboarding.complete.pathTemplate.subtitle')}
            onPress={handleTemplate}
            colors={colors}
            delay={510}
          />
        </View>

        <Animated.Text
          entering={FadeIn.delay(650).duration(500)}
          style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: colors.textMuted }}
        >
          {t('onboarding.complete.footer')}
        </Animated.Text>
      </ScrollView>

      <ImportReviewModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        onConfirm={handleImportConfirmed}
      />
    </SafeAreaView>
  );
}
