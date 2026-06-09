/**
 * AI "Tell me about yourself" Wizard
 * ----------------------------------
 *
 * The marquee differentiating feature. User types or speaks one paragraph
 * describing themselves; AI returns a fully structured resume payload
 * (header / summary / experience bullets / skills); user previews + applies.
 *
 * Flow:
 *   1. Compose — big text input, examples below, character counter
 *   2. Generating — full-screen loading state with delight copy
 *   3. Review — shows what the AI extracted with confidence + warnings,
 *               user can edit before applying
 *   4. Apply — same code path as the PDF import flow:
 *               mapParsedDataToResume → resumeStore.createResume → navigate
 *
 * The flow mirrors useResumeImport so all the downstream wiring (analytics,
 * review-prompt signals, store updates) is consistent with PDF import.
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
  ArrowLeft,
  Sparkles,
  Lightbulb,
  AlertCircle,
  Check,
  X,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useStructureFromNarrative } from '@/hooks/useAI';
import { mapParsedDataToResume } from '@/services/fileImport/resumeMapper';
import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';
import { seedNarrative } from '@/services/onboarding/personalize';

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
  const seeded = useMemo(() => seedNarrative(onboardingProfile), [onboardingProfile]);
  const [narrative, setNarrative] = useState(seeded);
  const [showExamples, setShowExamples] = useState(!seeded);

  const heroTitle = onboardingProfile.targetRole
    ? `Let's build your ${onboardingProfile.targetRole} resume`
    : 'Tell me about yourself';
  const heroSubtitle = seeded
    ? 'We started a draft from your answers. Replace the [brackets] with your details, then generate.'
    : 'Type or paste a paragraph or two about your role, experience, and skills. The AI will turn it into a structured resume you can edit and download.';

  const charCount = narrative.length;
  const charsToGo = MIN_CHARS - charCount;
  const canSubmit = charCount >= MIN_CHARS && !isLoading;

  const handleBack = useCallback(() => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router, hapticEnabled]);

  const handleUseExample = useCallback(
    (text: string) => {
      if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setNarrative(text);
      setShowExamples(false);
    },
    [hapticEnabled],
  );

  const handleGenerate = useCallback(async () => {
    if (!canSubmit) return;
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    track('ai_wizard_generate_started' as any, {
      char_count: charCount,
    });
    try {
      await structureAsync(narrative.trim());
    } catch {
      // Error surfaced via the hook's error state — UI handles it below.
    }
  }, [canSubmit, charCount, narrative, structureAsync, hapticEnabled]);

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

    track('ai_wizard_apply' as any, {
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
    if (c >= 0.8) return { text: 'High confidence', color: colors.success };
    if (c >= 0.55) return { text: 'Moderate confidence', color: colors.warning };
    return { text: 'Low confidence — review carefully', color: colors.error };
  }, [result, colors]);

  // -------- RESULT REVIEW VIEW --------
  if (result?.data) {
    const d = result.data;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Pressable onPress={handleRetry} hitSlop={8} style={{ padding: 4 }}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          <Text
            style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: colors.text }}
          >
            Review
          </Text>
          <View style={{ width: 30 }} />
        </View>

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
                  AI made these assumptions
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
          <ReviewBlock title="Personal" colors={colors}>
            <ReviewRow label="Name" value={d.header.fullName} colors={colors} />
            <ReviewRow label="Title" value={d.header.jobTitle} colors={colors} />
            {d.header.contact.location && (
              <ReviewRow label="Location" value={d.header.contact.location} colors={colors} />
            )}
          </ReviewBlock>

          {/* Summary */}
          {d.summary && (
            <ReviewBlock title="Summary" colors={colors}>
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{d.summary}</Text>
            </ReviewBlock>
          )}

          {/* Experience */}
          {d.experience.length > 0 && (
            <ReviewBlock title={`Experience (${d.experience.length})`} colors={colors}>
              {d.experience.map((exp, i) => (
                <View key={i} style={{ marginBottom: i < d.experience.length - 1 ? 14 : 0 }}>
                  <Text style={{ fontWeight: '600', color: colors.text, fontSize: 14 }}>
                    {exp.title || '(role unknown)'}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                    {exp.company || '(company unknown)'}
                    {exp.startDate ? ` · ${exp.startDate} – ${exp.endDate || 'Present'}` : ''}
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
            <ReviewBlock title={`Skills (${d.skills.length})`} colors={colors}>
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
            <ReviewBlock title="Education" colors={colors}>
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
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={handleRetry}
              style={{
                paddingVertical: 14,
                paddingHorizontal: 20,
                borderRadius: 12,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '600' }}>Try Again</Text>
            </Pressable>
            <Pressable
              onPress={handleApply}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: colors.primary,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
              }}
            >
              <Check size={18} color="white" />
              <Text style={{ color: 'white', fontWeight: '700', marginLeft: 6 }}>Create Resume</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // -------- COMPOSE VIEW (default) --------
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <Pressable onPress={handleBack} hitSlop={8} style={{ padding: 4 }}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          <Text
            style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: colors.text }}
          >
            Build with AI
          </Text>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          {/* Hero */}
          <Animated.View entering={FadeInUp.duration(300)}>
            <LinearGradient
              colors={[colors.primary, '#06B6D4']}
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
                  Tap an example to start
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {EXAMPLES.map((ex) => (
                  <Pressable
                    key={ex.label}
                    onPress={() => handleUseExample(ex.text)}
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

          {/* Char counter */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 8,
              paddingHorizontal: 4,
            }}
          >
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              {charCount < MIN_CHARS
                ? `${charsToGo} more character${charsToGo === 1 ? '' : 's'}`
                : `${charCount} / ${MAX_CHARS}`}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>{canSubmit ? 'Ready' : 'Add a bit more detail'}</Text>
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
                {error.message || 'Something went wrong. Try again.'}
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
          <Pressable
            onPress={handleGenerate}
            disabled={!canSubmit}
            style={{
              paddingVertical: 16,
              borderRadius: 14,
              backgroundColor: canSubmit ? colors.primary : colors.border,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
            }}
          >
            {isLoading ? (
              <>
                <ActivityIndicator color="white" />
                <Text style={{ marginLeft: 10, color: 'white', fontWeight: '700' }}>Building your resume…</Text>
              </>
            ) : (
              <>
                <Sparkles size={18} color="white" />
                <Text style={{ marginLeft: 8, color: 'white', fontWeight: '700', fontSize: 15 }}>
                  Generate my resume
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
