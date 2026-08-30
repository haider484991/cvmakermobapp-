/**
 * Interview prep for one application.
 *
 * The most valuable thing this app produces, and the most emotionally loaded —
 * someone opens this an hour before an interview. Two consequences shape the
 * screen:
 *
 *   - It is CACHED on the application after the first generation. People
 *     re-read prep several times in the days before an interview, and paying
 *     for a fresh model call each time would be both expensive and worse (the
 *     questions would keep changing under them).
 *   - The "gap" questions are surfaced with the same weight as the rest rather
 *     than buried. Those are the ones that ambush people, and they are the
 *     only part of this a generic interview-questions article cannot give you,
 *     because they come from what is missing on *this* CV.
 */

import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Lightbulb, RefreshCw, Share2, X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useApplicationStore } from '@/stores/applicationStore';
import { ScreenHeader } from '@/components/ui';
import { generateInterviewPrep } from '@/services/ai/resumeAI';
import { captureError } from '@/services/analytics/sentry';
import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';

const CATEGORY_ORDER = ['gap', 'role', 'experience', 'behavioral'] as const;

export default function InterviewPrep() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { hapticEnabled } = useUIStore();
  const { applications, setInterviewPrep } = useApplicationStore();
  const { getResume, getAllResumes, activeResumeId } = useResumeStore();

  const app = id ? applications[id] : undefined;
  const prep = app?.interviewPrep;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (isRegenerate: boolean) => {
      if (!app) return;
      setIsLoading(true);
      setError(null);
      const startedAt = Date.now();
      try {
        const all = getAllResumes();
        const resume =
          (app.resumeId ? getResume(app.resumeId) : null) ??
          (activeResumeId ? getResume(activeResumeId) : null) ??
          all[0] ??
          null;

        const result = await generateInterviewPrep(
          { jobTitle: app.title, company: app.company },
          resume,
        );
        setInterviewPrep(app.id, {
          questions: result.questions,
          askThem: result.askThem,
          generatedAt: new Date().toISOString(),
        });
        track(ANALYTICS_EVENTS.INTERVIEW_PREP_GENERATED, {
          regenerate: isRegenerate,
          question_count: result.questions.length,
          gap_questions: result.questions.filter((q) => q.category === 'gap').length,
          had_resume: Boolean(resume),
          duration_ms: Date.now() - startedAt,
          model: result.model,
        });
      } catch (err: any) {
        const code = err?.code ?? 'UNKNOWN';
        setError(err?.message || t('interview.error'));
        captureError(new Error(`Interview prep failed: ${code}`), { code });
        track(ANALYTICS_EVENTS.INTERVIEW_PREP_FAILED, { code });
      } finally {
        setIsLoading(false);
      }
    },
    [app, getAllResumes, getResume, activeResumeId, setInterviewPrep, t],
  );

  // Generate once, on first open. A cached prep is shown immediately and never
  // silently replaced — regenerating is the user's call.
  useEffect(() => {
    if (app && !prep && !isLoading && !error) void generate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.id]);

  const shareAll = useCallback(async () => {
    if (!prep || !app) return;
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const text = [
      `${app.title} — ${app.company}`,
      '',
      ...prep.questions.map((q) => `• ${q.question}\n  ${q.angle}`),
      '',
      t('interview.askThem'),
      ...prep.askThem.map((q) => `• ${q}`),
    ].join('\n');
    track(ANALYTICS_EVENTS.INTERVIEW_PREP_SHARED, {});
    try {
      await Share.share({ message: text });
    } catch {
      // user cancelled
    }
  }, [prep, app, hapticEnabled, t]);

  if (!app) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={t('interview.title')} onBack={() => router.back()} />
        <View style={{ padding: 24 }}>
          <Text style={{ color: colors.textSecondary }}>{t('followUp.missing')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const categoryColor = (category: string) =>
    category === 'gap' ? colors.warning : colors.primary;

  const ordered = prep
    ? [...prep.questions].sort(
        (a, b) =>
          CATEGORY_ORDER.indexOf(a.category as (typeof CATEGORY_ORDER)[number]) -
          CATEGORY_ORDER.indexOf(b.category as (typeof CATEGORY_ORDER)[number]),
      )
    : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t('interview.title')} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{app.title}</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2, marginBottom: 18 }}>
          {app.company}
        </Text>

        {isLoading && (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ marginLeft: 10, color: colors.textSecondary }}>
              {t('interview.preparing')}
            </Text>
          </View>
        )}

        {error && !isLoading && (
          <View
            style={{
              padding: 12,
              borderRadius: 10,
              backgroundColor: colors.error + '12',
              borderWidth: 1,
              borderColor: colors.error + '40',
              flexDirection: 'row',
              alignItems: 'flex-start',
              marginBottom: 16,
            }}
          >
            <X size={16} color={colors.error} />
            <Text style={{ marginLeft: 8, flex: 1, color: colors.error, fontSize: 13, lineHeight: 18 }}>
              {error}
            </Text>
          </View>
        )}

        {!isLoading && prep && (
          <>
            {ordered.map((q, i) => (
              <Animated.View
                key={`${q.question}-${i}`}
                entering={FadeInUp.delay(Math.min(i, 8) * 40).duration(260)}
                style={{
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: q.category === 'gap' ? colors.warning + '55' : colors.border,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    alignSelf: 'flex-start',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 100,
                    backgroundColor: categoryColor(q.category) + '18',
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: categoryColor(q.category) }}>
                    {t(`interview.category.${q.category}`)}
                  </Text>
                </View>

                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 21 }}>
                  {q.question}
                </Text>

                {q.why ? (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 }}>
                    <HelpCircle size={14} color={colors.textMuted} style={{ marginTop: 2 }} />
                    <Text
                      style={{ marginLeft: 6, flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}
                    >
                      {q.why}
                    </Text>
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                  <Lightbulb size={14} color={colors.primary} style={{ marginTop: 2 }} />
                  <Text style={{ marginLeft: 6, flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 }}>
                    {q.angle}
                  </Text>
                </View>
              </Animated.View>
            ))}

            {prep.askThem.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 }}>
                  {t('interview.askThem')}
                </Text>
                {prep.askThem.map((q) => (
                  <View key={q} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                    <Text style={{ color: colors.primary, fontSize: 14, lineHeight: 20 }}>• </Text>
                    <Text style={{ flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 }}>{q}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 22 }}>
              <Pressable
                onPress={() => generate(true)}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RefreshCw size={15} color={colors.text} />
                <Text style={{ marginLeft: 6, color: colors.text, fontWeight: '600' }}>
                  {t('interview.regenerate')}
                </Text>
              </Pressable>
              <Pressable
                onPress={shareAll}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Share2 size={15} color={colors.text} />
                <Text style={{ marginLeft: 6, color: colors.text, fontWeight: '600' }}>
                  {t('interview.share')}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
