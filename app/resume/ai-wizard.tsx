/**
 * AI "Tell me about yourself" Wizard
 * ----------------------------------
 *
 * The marquee differentiating feature. User types or speaks one paragraph
 * describing themselves; AI returns a fully structured resume payload
 * (header / summary / experience bullets / skills); user previews + applies.
 *
 * Flow:
 *   1. Compose — text input with a live readiness coach (see below)
 *   2. Generating — full-screen loading state with delight copy
 *   3. Review — shows what the AI extracted with confidence + warnings,
 *               user can edit before applying
 *   4. Apply — same code path as the PDF import flow:
 *               mapParsedDataToResume → resumeStore.createResume → navigate
 *
 * The flow mirrors useResumeImport so all the downstream wiring (analytics,
 * review-prompt signals, store updates) is consistent with PDF import.
 *
 * v1.14 — the input gate. The old compose step accepted anything past 30
 * characters and labelled it "Ready". Measured over 60 days, 14 of 36
 * generations were EXAMPLES[0] submitted verbatim and most of the rest were
 * the onboarding scaffold with its [brackets] intact; all of them returned
 * confidence 0.25 with zero skills, and those users left. So now:
 *
 *   - `analyseNarrative()` blocks generation while the box still holds a
 *     template WE supplied (see services/ai/narrativeQuality.ts), and the
 *     Generate button explains why instead of going quietly grey.
 *   - The character counter is a readiness meter that names what's missing.
 *   - The outcome is finally instrumented: _SUCCEEDED carries confidence and
 *     section counts, _FAILED carries the error code and reaches Sentry.
 *     Before this, handleGenerate swallowed every failure in a bare catch,
 *     so a broken generation and a great one looked identical in the data.
 *   - A thin result no longer offers "Create Resume" as the primary exit.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Sparkles,
  Lightbulb,
  AlertCircle,
  Check,
  X,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useStructureFromNarrative } from '@/hooks/useAI';
import { mapParsedDataToResume } from '@/services/fileImport/resumeMapper';
import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';
import { captureError } from '@/services/analytics/sentry';
import { ScreenHeader } from '@/components/ui';
import { seedNarrative } from '@/services/onboarding/personalize';
import { analyseNarrative, missingSignalKeys } from '@/services/ai/narrativeQuality';
import { GuidedComposer } from '@/components/features/wizard/GuidedComposer';
import { gradientColors } from '@/constants/theme';

const MIN_CHARS = 30;
const MAX_CHARS = 6000;

const EXAMPLES: Array<{ label: string; text: string }> = [
  {
    label: 'Senior engineer',
    text: "I'm a senior software engineer with 8 years of experience. The last 3 years I led the platform team at Stripe where we rebuilt the payment routing system that processes $500B/year. Before that I was at Square working on Cash App's backend. I'm strong in Go, Rust, and distributed systems, and I've shipped 4 production services that handle millions of requests per day. I have a B.S. in Computer Science from UC Berkeley.",
  },
  {
    label: 'Product designer',
    text: "Product designer with 5 years in B2B SaaS. Currently lead designer at Linear — I shipped the timeline view used by 100K+ teams and redesigned the issue create flow. Previously at Notion working on the docs editor. I work in Figma, run user research, and write design docs. Worked on a launch that got featured on Product Hunt.",
  },
  {
    label: 'Career changer',
    text: "I'm transitioning from teaching into UX research. Taught high school math for 6 years, ran a coding club, and just finished the Coursera UX research certificate. I'm comfortable with interviewing, synthesizing notes, and presenting findings. Looking for entry-level UX research roles. Based in Austin, TX.",
  },
];

export default function AIWizard() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { hapticEnabled, onboardingProfile } = useUIStore();
  const { setActiveResume } = useResumeStore();
  const {
    structureAsync,
    isLoading,
    data: result,
    error,
    reset,
  } = useStructureFromNarrative();

  // If the user came through onboarding, start them with a scaffold built
  // from their answers instead of a blank box — the blank page is where most
  // wizard users used to give up. The scaffold has [bracketed] prompts to fill.
  const seeded = useMemo(() => seedNarrative(onboardingProfile, t), [onboardingProfile, t]);
  const [narrative, setNarrative] = useState(seeded);
  const [showExamples, setShowExamples] = useState(!seeded);

  /**
   * Guided is the default. The free-text box is kept for people who genuinely
   * want to write — it's a better experience for them, and it's now gated —
   * but it is no longer what a first-time user is dropped into, because that
   * is the screen they were abandoning.
   */
  const [mode, setMode] = useState<'guided' | 'freeform'>('guided');

  const heroTitle = onboardingProfile.targetRole
    ? t('wizard.heroTitleWithRole', { role: onboardingProfile.targetRole })
    : t('wizard.heroTitle');
  const heroSubtitle = seeded ? t('wizard.heroSubtitleSeeded') : t('wizard.heroSubtitle');

  const charCount = narrative.length;
  const charsToGo = MIN_CHARS - charCount;

  // Every template we ourselves put in the box. If the user hits Generate
  // with one of these untouched we must not spend a paid call on it — that
  // was 14 of 36 generations before v1.14, every one returning a blank resume.
  const templates = useMemo(
    () => [seeded, ...EXAMPLES.map((e) => e.text)].filter(Boolean),
    [seeded],
  );
  const quality = useMemo(
    () => analyseNarrative(narrative, templates),
    [narrative, templates],
  );
  const hintKeys = useMemo(() => missingSignalKeys(quality), [quality]);

  const readiness = useMemo(() => {
    if (quality.isPlaceholder) return { label: t('wizard.readiness.placeholder'), color: colors.warning };
    if (charCount < MIN_CHARS) return { label: t('wizard.readiness.keepGoing'), color: colors.textMuted };
    switch (quality.readiness) {
      case 'strong':
        return { label: t('wizard.readiness.strong'), color: colors.success };
      case 'ok':
        return { label: t('wizard.readiness.ok'), color: colors.warning };
      default:
        return { label: t('wizard.readiness.thin'), color: colors.textMuted };
    }
  }, [quality, charCount, colors, t]);

  /** Long enough to be worth a call — the button responds from here on. */
  const isTappable = charCount >= MIN_CHARS && !isLoading;
  /** ...and it's the user's own writing, so we'll actually spend the call. */
  const canSubmit = isTappable && !quality.isPlaceholder;

  const handleBack = useCallback(() => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router, hapticEnabled]);

  const handleUseExample = useCallback(
    (label: string, text: string) => {
      if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setNarrative(text);
      setShowExamples(false);
      track(ANALYTICS_EVENTS.AI_WIZARD_EXAMPLE_USED, { example: label });
    },
    [hapticEnabled],
  );

  /**
   * The one place a generation is actually spent. Both composers funnel here
   * so the guided and free-text paths are instrumented identically — the
   * `source` property is what will tell us which one produces better resumes.
   */
  const runGeneration = useCallback(
    async (text: string, source: 'guided' | 'freeform') => {
      const q = analyseNarrative(text, []);
      if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      track(ANALYTICS_EVENTS.AI_WIZARD_GENERATE_STARTED, {
        source,
        char_count: text.length,
        word_count: q.wordCount,
        quality_score: q.score,
        readiness: q.readiness,
      });

      const startedAt = Date.now();
      try {
        const res = await structureAsync(text.trim());
        // The outcome the old bare catch threw away: was the result any good?
        track(ANALYTICS_EVENTS.AI_WIZARD_GENERATE_SUCCEEDED, {
          source,
          confidence: res.confidence,
          warnings_count: res.warnings.length,
          experience_count: res.data.experience?.length ?? 0,
          skills_count: res.data.skills?.length ?? 0,
          education_count: res.data.education?.length ?? 0,
          quality_score: q.score,
          duration_ms: Date.now() - startedAt,
          model: res.model,
        });
      } catch (err: any) {
        const code = err?.code ?? 'UNKNOWN';
        track(ANALYTICS_EVENTS.AI_WIZARD_GENERATE_FAILED, {
          source,
          code,
          message: String(err?.message ?? '').slice(0, 200),
          char_count: text.length,
          quality_score: q.score,
          duration_ms: Date.now() - startedAt,
        });
        // Deliberate capture — the wizard is the app's marquee feature and its
        // failures reached neither Sentry nor analytics before v1.14.
        captureError(new Error(`AI wizard generate failed: ${code}`), {
          code,
          source,
          char_count: text.length,
          quality_score: q.score,
        });
        // The message itself is surfaced via the hook's error state below.
      }
    },
    [structureAsync, hapticEnabled],
  );

  const handleGenerate = useCallback(async () => {
    // Tapping a disabled button still lands here on some Android builds, so
    // record the placeholder case rather than failing silently — this is the
    // metric that tells us whether the new guard is doing its job.
    if (quality.isPlaceholder) {
      if (hapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      track(ANALYTICS_EVENTS.AI_WIZARD_BLOCKED_PLACEHOLDER, {
        reason: quality.placeholderReason,
        char_count: charCount,
      });
      return;
    }
    if (!canSubmit) return;
    await runGeneration(narrative, 'freeform');
  }, [canSubmit, charCount, narrative, hapticEnabled, quality, runGeneration]);

  const handleGuidedSubmit = useCallback(
    (composed: string) => {
      setNarrative(composed);
      void runGeneration(composed, 'guided');
    },
    [runGeneration],
  );

  const switchMode = useCallback(
    (next: 'guided' | 'freeform') => {
      setMode(next);
      track(ANALYTICS_EVENTS.AI_WIZARD_MODE_SELECTED, { mode: next });
    },
    [],
  );

  const handleApply = useCallback(() => {
    if (!result?.data) return;
    if (hapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Reuse the same downstream pipeline as PDF import so we share all
    // the field-mapping + validation work.
    const resume = mapParsedDataToResume(result.data, 'My AI Resume');

    // Backfill from onboarding if the AI didn't surface a name/title — better
    // to ship their resume with their real name than "(role unknown)".
    if (!resume.header.fullName && onboardingProfile.firstName) {
      resume.header.fullName = onboardingProfile.firstName.trim();
    }
    if (!resume.header.jobTitle && onboardingProfile.targetRole) {
      resume.header.jobTitle = onboardingProfile.targetRole.trim();
    }

    const resumeStore = useResumeStore.getState();
    const id = resumeStore.createResume(resume.name);

    resumeStore.updateHeader(id, resume.header);
    resumeStore.updateSummary(id, resume.summary);
    resume.experience.forEach((exp) => resumeStore.addExperience(id, exp));
    resume.education.forEach((edu) => resumeStore.addEducation(id, edu));
    resume.skills.forEach((skill) => resumeStore.addSkill(id, skill));
    resume.projects.forEach((proj) => resumeStore.addProject(id, proj));

    setActiveResume(id);

    track(ANALYTICS_EVENTS.AI_WIZARD_APPLY, {
      confidence: result.confidence,
      warnings_count: result.warnings.length,
      experience_count: resume.experience.length,
      skills_count: resume.skills.length,
      education_count: resume.education.length,
    });

    router.replace(`/resume/${id}`);
  }, [result, hapticEnabled, setActiveResume, router]);

  const handleRetry = useCallback(() => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reset();
  }, [reset, hapticEnabled]);

  const confidenceLabel = useMemo(() => {
    if (!result) return null;
    const c = result.confidence;
    if (c >= 0.8) return { text: t('wizard.confidence.high'), color: colors.success };
    if (c >= 0.55) return { text: t('wizard.confidence.moderate'), color: colors.warning };
    return { text: t('wizard.confidence.low'), color: colors.error };
  }, [result, colors, t]);

  // -------- RESULT REVIEW VIEW --------
  if (result?.data) {
    const d = result.data;
    // Measured: every placeholder submission came back at confidence 0.25
    // with zero skills and zero education. Applying that produces an empty
    // resume the user then abandons, so when the result is this thin we make
    // "go back and add detail" the primary action instead of the exit.
    const isWeakResult =
      result.confidence < 0.4 || (d.skills.length === 0 && d.experience.length === 0);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={t('wizard.reviewTitle')} onBack={handleRetry} />

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {/* Confidence + warnings */}
          {confidenceLabel && (
            <Animated.View
              entering={FadeIn.duration(200)}
              style={{
                padding: 12,
                borderRadius: 12,
                backgroundColor: confidenceLabel.color + '12',
                borderWidth: 1,
                borderColor: confidenceLabel.color + '40',
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Check size={18} color={confidenceLabel.color} />
              <Text style={{ marginLeft: 8, color: confidenceLabel.color, fontWeight: '600' }}>
                {confidenceLabel.text}
              </Text>
            </Animated.View>
          )}

          {result.warnings.length > 0 && (
            <View
              style={{
                padding: 12,
                borderRadius: 12,
                backgroundColor: colors.warning + '10',
                borderWidth: 1,
                borderColor: colors.warning + '30',
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <AlertCircle size={16} color={colors.warning} />
                <Text style={{ marginLeft: 6, color: colors.warning, fontWeight: '600', fontSize: 13 }}>
                  {t('wizard.assumptions')}
                </Text>
              </View>
              {result.warnings.map((w, i) => (
                <Text key={i} style={{ fontSize: 13, color: colors.text, marginBottom: 4, lineHeight: 18 }}>
                  • {w}
                </Text>
              ))}
            </View>
          )}

          {/* Header preview */}
          <ReviewBlock title={t('wizard.section.personal')} colors={colors}>
            <ReviewRow label={t('wizard.field.name')} value={d.header.fullName} colors={colors} />
            <ReviewRow label={t('wizard.field.title')} value={d.header.jobTitle} colors={colors} />
            {d.header.contact.location && (
              <ReviewRow label={t('wizard.field.location')} value={d.header.contact.location} colors={colors} />
            )}
          </ReviewBlock>

          {/* Summary */}
          {d.summary && (
            <ReviewBlock title={t('wizard.section.summary')} colors={colors}>
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{d.summary}</Text>
            </ReviewBlock>
          )}

          {/* Experience */}
          {d.experience.length > 0 && (
            <ReviewBlock title={t('wizard.section.experience', { count: String(d.experience.length) })} colors={colors}>
              {d.experience.map((exp, i) => (
                <View key={i} style={{ marginBottom: i < d.experience.length - 1 ? 14 : 0 }}>
                  <Text style={{ fontWeight: '600', color: colors.text, fontSize: 14 }}>
                    {exp.title || t('wizard.roleUnknown')}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                    {exp.company || t('wizard.companyUnknown')}
                    {exp.startDate ? ` · ${exp.startDate} – ${exp.endDate || t('wizard.present')}` : ''}
                  </Text>
                  {exp.bullets && exp.bullets.length > 0 && (
                    <View style={{ marginTop: 6 }}>
                      {exp.bullets.map((b, j) => (
                        <Text key={j} style={{ color: colors.text, fontSize: 13, lineHeight: 18, marginBottom: 2 }}>
                          • {b}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </ReviewBlock>
          )}

          {/* Skills */}
          {d.skills.length > 0 && (
            <ReviewBlock title={t('wizard.section.skills', { count: String(d.skills.length) })} colors={colors}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {d.skills.map((s, i) => (
                  <View
                    key={i}
                    style={{
                      backgroundColor: colors.primary + '12',
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '500' }}>{s.name}</Text>
                  </View>
                ))}
              </View>
            </ReviewBlock>
          )}

          {/* Education */}
          {d.education.length > 0 && (
            <ReviewBlock title={t('wizard.section.education')} colors={colors}>
              {d.education.map((edu, i) => (
                <View key={i} style={{ marginBottom: i < d.education.length - 1 ? 10 : 0 }}>
                  <Text style={{ fontWeight: '600', color: colors.text, fontSize: 14 }}>
                    {edu.degree}{edu.field ? ` in ${edu.field}` : ''}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{edu.institution}</Text>
                </View>
              ))}
            </ReviewBlock>
          )}
        </ScrollView>

        {/* Apply button */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 16,
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          {isWeakResult && (
            <Text
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                marginBottom: 10,
                lineHeight: 17,
              }}
            >
              {t('wizard.weakResult')}
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={handleRetry}
              style={{
                flex: isWeakResult ? 1 : undefined,
                paddingVertical: 14,
                paddingHorizontal: 20,
                borderRadius: 12,
                backgroundColor: isWeakResult ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: isWeakResult ? colors.primary : colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: isWeakResult ? 'white' : colors.text, fontWeight: isWeakResult ? '700' : '600' }}>
                {isWeakResult ? t('wizard.addMoreDetail') : t('wizard.tryAgain')}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleApply}
              style={{
                flex: isWeakResult ? undefined : 1,
                paddingVertical: 14,
                paddingHorizontal: isWeakResult ? 20 : undefined,
                borderRadius: 12,
                backgroundColor: isWeakResult ? colors.surface : colors.primary,
                borderWidth: isWeakResult ? 1 : 0,
                borderColor: colors.border,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
              }}
            >
              {!isWeakResult && <Check size={18} color="white" />}
              <Text
                style={{
                  color: isWeakResult ? colors.text : 'white',
                  fontWeight: isWeakResult ? '600' : '700',
                  marginLeft: isWeakResult ? 0 : 6,
                }}
              >
                {isWeakResult ? t('wizard.useAnyway') : t('wizard.createResume')}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // -------- GUIDED COMPOSE VIEW (default) --------
  if (mode === 'guided') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScreenHeader title={t('wizard.title')} onBack={handleBack} />
          <GuidedComposer
            isLoading={isLoading}
            onSubmit={handleGuidedSubmit}
            onSwitchToFreeText={() => switchMode('freeform')}
          />
          {error && (
            <View
              style={{
                margin: 16,
                padding: 12,
                borderRadius: 10,
                backgroundColor: colors.error + '12',
                borderWidth: 1,
                borderColor: colors.error + '40',
                flexDirection: 'row',
                alignItems: 'flex-start',
              }}
            >
              <X size={16} color={colors.error} />
              <Text style={{ marginLeft: 8, flex: 1, color: colors.error, fontSize: 13, lineHeight: 18 }}>
                {error.message || t('wizard.genericError')}
              </Text>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // -------- FREE-TEXT COMPOSE VIEW --------
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <ScreenHeader title={t('wizard.title')} onBack={() => switchMode('guided')} />

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          {/* Hero */}
          <Animated.View entering={FadeInUp.duration(300)}>
            <LinearGradient
              colors={gradientColors.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 16, padding: 20, marginBottom: 20 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Sparkles size={20} color="white" />
                <Text style={{ marginLeft: 8, color: 'white', fontSize: 16, fontWeight: '700' }}>
                  {heroTitle}
                </Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 13, lineHeight: 18 }}>
                {heroSubtitle}
              </Text>
            </LinearGradient>
          </Animated.View>

          {/* Examples */}
          {showExamples && (
            <Animated.View entering={FadeIn.duration(300)} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Lightbulb size={14} color={colors.textSecondary} />
                <Text style={{ marginLeft: 6, color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                  {t('wizard.examplesLabel')}
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {EXAMPLES.map((ex) => (
                  <Pressable
                    key={ex.label}
                    onPress={() => handleUseExample(ex.label, ex.text)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      borderRadius: 100,
                      backgroundColor: colors.primary + '12',
                      borderWidth: 1,
                      borderColor: colors.primary + '30',
                    }}
                  >
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>{ex.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Animated.View>
          )}

          {/* Input */}
          <TextInput
            value={narrative}
            onChangeText={(t) => {
              if (t.length <= MAX_CHARS) setNarrative(t);
            }}
            placeholder={"I've been a [role] for [n] years. Currently at [company] doing [main work]. Before that I [previous role]. I'm strong in [tools/skills]..."}
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              padding: 16,
              minHeight: 200,
              color: colors.text,
              fontSize: 15,
              lineHeight: 22,
            }}
          />

          {/* Readiness coach — replaces the old bare character counter, which
              labelled an untouched template "Ready" and let it through. */}
          <View style={{ marginTop: 10 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 4,
                marginBottom: 8,
              }}
            >
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                {charCount < MIN_CHARS
                  ? t('wizard.charsToGo', { count: String(charsToGo) })
                  : t('wizard.words', { count: String(quality.wordCount) })}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: readiness.color }}>
                {readiness.label}
              </Text>
            </View>

            {/* Strength bar */}
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${quality.isPlaceholder ? 0 : quality.score}%`,
                  height: '100%',
                  borderRadius: 2,
                  backgroundColor: readiness.color,
                }}
              />
            </View>

            {/* Why we're blocking, or what's still missing */}
            {quality.isPlaceholder ? (
              <View
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 10,
                  backgroundColor: colors.warning + '12',
                  borderWidth: 1,
                  borderColor: colors.warning + '35',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                }}
              >
                <AlertCircle size={16} color={colors.warning} />
                <Text style={{ marginLeft: 8, flex: 1, color: colors.text, fontSize: 13, lineHeight: 18 }}>
                  {quality.placeholderReason === 'brackets'
                    ? t('wizard.blocked.brackets')
                    : t('wizard.blocked.template')}
                </Text>
              </View>
            ) : (
              hintKeys.length > 0 &&
              charCount >= MIN_CHARS && (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>
                    {t('wizard.hintsTitle')}
                  </Text>
                  {hintKeys.map((h) => (
                    <View key={h} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>+ </Text>
                      <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
                        {t(`wizard.hint.${h}`)}
                      </Text>
                    </View>
                  ))}
                </View>
              )
            )}
          </View>

          {/* Error */}
          {error && (
            <View
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 10,
                backgroundColor: colors.error + '12',
                borderWidth: 1,
                borderColor: colors.error + '40',
                flexDirection: 'row',
                alignItems: 'flex-start',
              }}
            >
              <X size={16} color={colors.error} />
              <Text style={{ marginLeft: 8, flex: 1, color: colors.error, fontSize: 13, lineHeight: 18 }}>
                {error.message || t('wizard.genericError')}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Generate button */}
        <View
          style={{
            padding: 16,
            paddingBottom: 24,
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          {/* Deliberately still tappable while the text is our own template:
              a dead grey button explains nothing and, because the press never
              lands, we'd never learn how often people hit this wall. Tapping
              it explains why and records AI_WIZARD_BLOCKED_PLACEHOLDER. */}
          <Pressable
            onPress={handleGenerate}
            disabled={!isTappable}
            style={{
              paddingVertical: 16,
              borderRadius: 14,
              backgroundColor: canSubmit
                ? colors.primary
                : isTappable
                  ? colors.warning
                  : colors.border,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
            }}
          >
            {isLoading ? (
              <>
                <ActivityIndicator color="white" />
                <Text style={{ marginLeft: 10, color: 'white', fontWeight: '700' }}>{t('wizard.generating')}</Text>
              </>
            ) : (
              <>
                <Sparkles size={18} color="white" />
                <Text style={{ marginLeft: 8, color: 'white', fontWeight: '700', fontSize: 15 }}>
                  {quality.isPlaceholder ? t('wizard.generateBlocked') : t('wizard.generate')}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------------ */
/* Helpers                                                                  */
/* ------------------------------------------------------------------------ */

function ReviewBlock({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View
      style={{
        marginBottom: 14,
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          color: colors.primary,
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function ReviewRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', marginBottom: 6 }}>
      <Text style={{ width: 80, fontSize: 12, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>{value}</Text>
    </View>
  );
}
