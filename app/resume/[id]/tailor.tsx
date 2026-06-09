/**
 * Tailor to Job (v1.10) — the premium tier's killer feature.
 *
 * Flow:
 *   1. Paste a job posting → Analyze (FREE — this is the hook)
 *   2. See: match score, matched + missing keywords, what a rewrite covers
 *   3. "Apply tailored rewrite" — PRO. Free users hit the paywall with the
 *      value already proven on screen; premium users apply in one tap:
 *      summary rewrite + per-experience bullets + missing skills.
 *
 * Why analyze-free/apply-paid: the score + missing keywords make the gap
 * concrete ("you're at 58% for this job") — the strongest possible setup
 * for the Pro pitch, while still giving free users real, honest value.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Target, Check, X, Sparkles, Lock } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useResumeStore } from '@/stores/resumeStore';
import { usePremium } from '@/hooks/usePremium';
import { usePurchasesStore, selectIsPremium } from '@/stores/purchasesStore';
import { useTailorToJob } from '@/hooks/useAI';
import { PaywallModal } from '@/components/features/paywall/PaywallModal';
import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';

const MIN_JD_CHARS = 60;
const MAX_JD_CHARS = 12000;

function KeywordChip({ label, kind, colors }: { label: string; kind: 'match' | 'miss'; colors: any }) {
  const tone = kind === 'match' ? colors.success : colors.warning;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: tone + '14',
        borderWidth: 1,
        borderColor: tone + '40',
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 5,
        gap: 4,
      }}
    >
      {kind === 'match' ? <Check size={11} color={tone} strokeWidth={3} /> : <X size={11} color={tone} strokeWidth={3} />}
      <Text style={{ fontSize: 12, fontWeight: '600', color: tone }}>{label}</Text>
    </View>
  );
}

export default function TailorToJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { hapticEnabled } = useUIStore();
  const { isPremium } = usePremium();
  const { getResume, updateSummary, updateExperience, addSkill } = useResumeStore();
  const { tailorAsync, isLoading, data: result, error, reset } = useTailorToJob();

  const [jobDescription, setJobDescription] = useState('');
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [applied, setApplied] = useState(false);

  const resume = id ? getResume(id) : null;
  const canAnalyze = jobDescription.trim().length >= MIN_JD_CHARS && !isLoading;

  useEffect(() => {
    track(ANALYTICS_EVENTS.TAILOR_OPENED, { is_premium: isPremium });
  }, []);

  const handleBack = useCallback(() => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router, hapticEnabled]);

  const handleAnalyze = useCallback(async () => {
    if (!resume || !canAnalyze) return;
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const r = await tailorAsync({ resume, jobDescription: jobDescription.trim() });
      track(ANALYTICS_EVENTS.TAILOR_ANALYZED, {
        match_score: r.matchScore,
        missing_count: r.missingKeywords.length,
        rewrites_count: r.experienceRewrites.length,
      });
    } catch {
      // surfaced via hook error state below
    }
  }, [resume, canAnalyze, jobDescription, tailorAsync, hapticEnabled]);

  const applyRewrites = useCallback(() => {
    if (!resume || !result) return;
    if (result.summaryRewrite) updateSummary(resume.id, result.summaryRewrite);
    for (const rw of result.experienceRewrites) {
      updateExperience(resume.id, rw.experienceId, { bullets: rw.bullets });
    }
    const existing = new Set(resume.skills.map((s) => s.name.toLowerCase()));
    result.skillsToAdd.forEach((name, i) => {
      if (!existing.has(name.toLowerCase())) {
        addSkill(resume.id, { id: `${Date.now()}-tailor-${i}`, name });
      }
    });
    setApplied(true);
    if (hapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    track(ANALYTICS_EVENTS.TAILOR_APPLIED, { match_score: result.matchScore });
    Alert.alert(
      'Resume tailored ✓',
      'Summary, bullet points, and skills updated for this job. Review them in the editor.',
      [{ text: 'View resume', onPress: () => router.back() }],
    );
  }, [resume, result, updateSummary, updateExperience, addSkill, hapticEnabled, router]);

  const handleApply = useCallback(() => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isPremium) {
      setPaywallVisible(true);
      return;
    }
    applyRewrites();
  }, [isPremium, applyRewrites, hapticEnabled]);

  const scoreColor = (s: number) => (s >= 75 ? colors.success : s >= 50 ? colors.warning : colors.error);

  if (!resume) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textSecondary }}>Resume not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
          <Pressable onPress={handleBack} hitSlop={8} style={{ padding: 4 }}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: colors.text }}>
            Tailor to a Job
          </Text>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          {/* ---------- RESULTS ---------- */}
          {result ? (
            <>
              {/* Match score */}
              <Animated.View
                entering={FadeIn.duration(250)}
                style={{
                  alignItems: 'center',
                  padding: 20,
                  borderRadius: 16,
                  backgroundColor: scoreColor(result.matchScore) + '10',
                  borderWidth: 1,
                  borderColor: scoreColor(result.matchScore) + '35',
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.5 }}>
                  MATCH WITH THIS JOB
                </Text>
                <Text style={{ fontSize: 52, fontWeight: '800', color: scoreColor(result.matchScore), marginVertical: 2 }}>
                  {result.matchScore}%
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>
                  {result.matchScore >= 75
                    ? 'Strong match — the rewrite sharpens it further.'
                    : result.matchScore >= 50
                      ? 'Decent base — the tailored rewrite closes the gaps below.'
                      : 'Big gaps — tailoring will make a real difference here.'}
                </Text>
              </Animated.View>

              {/* Matched keywords */}
              {result.matchedKeywords.length > 0 && (
                <Animated.View entering={FadeInUp.delay(80).duration(300)} style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 }}>
                    ✓ Already on your resume
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                    {result.matchedKeywords.map((k) => (
                      <KeywordChip key={k} label={k} kind="match" colors={colors} />
                    ))}
                  </View>
                </Animated.View>
              )}

              {/* Missing keywords */}
              {result.missingKeywords.length > 0 && (
                <Animated.View entering={FadeInUp.delay(140).duration(300)} style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 }}>
                    ✗ Missing — an ATS will flag these
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                    {result.missingKeywords.map((k) => (
                      <KeywordChip key={k} label={k} kind="miss" colors={colors} />
                    ))}
                  </View>
                </Animated.View>
              )}

              {/* What the rewrite covers */}
              <Animated.View
                entering={FadeInUp.delay(200).duration(300)}
                style={{
                  borderRadius: 16,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <Sparkles size={16} color={colors.primary} />
                  <Text style={{ marginLeft: 6, fontSize: 15, fontWeight: '700', color: colors.text }}>
                    Your tailored rewrite is ready
                  </Text>
                </View>
                {result.summaryRewrite ? (
                  <View style={{ marginBottom: 10 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: 4, letterSpacing: 0.5 }}>
                      NEW SUMMARY
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.text, lineHeight: 19 }} numberOfLines={isPremium ? undefined : 2}>
                      {result.summaryRewrite}
                    </Text>
                    {!isPremium && (
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>… unlocked with Pro</Text>
                    )}
                  </View>
                ) : null}
                <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>
                  {result.experienceRewrites.length > 0 &&
                    `• ${result.experienceRewrites.length} experience ${result.experienceRewrites.length === 1 ? 'entry' : 'entries'} rewritten for this posting\n`}
                  {result.skillsToAdd.length > 0 && `• ${result.skillsToAdd.length} missing skills added: ${result.skillsToAdd.join(', ')}\n`}
                  • Keywords woven in naturally — no stuffing
                </Text>
              </Animated.View>

              {/* Apply / try another */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable
                  onPress={() => {
                    reset();
                    setApplied(false);
                  }}
                  style={{
                    paddingVertical: 15,
                    paddingHorizontal: 18,
                    borderRadius: 13,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '600' }}>New job post</Text>
                </Pressable>
                <Pressable
                  onPress={handleApply}
                  disabled={applied}
                  style={{
                    flex: 1,
                    paddingVertical: 15,
                    borderRadius: 13,
                    backgroundColor: applied ? colors.success : colors.primary,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    opacity: applied ? 0.85 : 1,
                  }}
                >
                  {applied ? (
                    <Check size={17} color="white" strokeWidth={3} />
                  ) : isPremium ? (
                    <Sparkles size={16} color="white" />
                  ) : (
                    <Lock size={15} color="white" />
                  )}
                  <Text style={{ color: 'white', fontWeight: '700', marginLeft: 7, fontSize: 15 }}>
                    {applied ? 'Applied' : isPremium ? 'Apply tailored rewrite' : 'Apply with Pro'}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            /* ---------- INPUT ---------- */
            <>
              <Animated.View entering={FadeInUp.duration(300)}>
                <LinearGradient
                  colors={[colors.primary, '#06B6D4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ borderRadius: 16, padding: 20, marginBottom: 18 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Target size={20} color="white" />
                    <Text style={{ marginLeft: 8, color: 'white', fontSize: 16, fontWeight: '700' }}>
                      Tailor your resume to a job
                    </Text>
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 13, lineHeight: 18 }}>
                    Paste a job posting. AI scores your match, shows the keywords you're missing, and
                    rewrites your resume to fit — truthfully, no fabrication.
                  </Text>
                </LinearGradient>
              </Animated.View>

              <TextInput
                value={jobDescription}
                onChangeText={(t) => {
                  if (t.length <= MAX_JD_CHARS) setJobDescription(t);
                }}
                placeholder="Paste the job posting here — at minimum the responsibilities and requirements sections…"
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 14,
                  padding: 16,
                  minHeight: 220,
                  color: colors.text,
                  fontSize: 14,
                  lineHeight: 21,
                }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {jobDescription.trim().length < MIN_JD_CHARS
                    ? `${MIN_JD_CHARS - jobDescription.trim().length} more characters`
                    : `${jobDescription.length} / ${MAX_JD_CHARS}`}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  Free analysis · Pro applies the rewrite
                </Text>
              </View>

              {error && (
                <View
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: colors.error + '12',
                    borderWidth: 1,
                    borderColor: colors.error + '40',
                  }}
                >
                  <Text style={{ color: colors.error, fontSize: 13, lineHeight: 18 }}>
                    {error.message || 'Something went wrong. Try again.'}
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Analyze CTA (input state only) */}
        {!result && (
          <View style={{ padding: 16, paddingBottom: 24, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Pressable
              onPress={handleAnalyze}
              disabled={!canAnalyze}
              style={{
                paddingVertical: 16,
                borderRadius: 14,
                backgroundColor: canAnalyze ? colors.primary : colors.border,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
              }}
            >
              {isLoading ? (
                <>
                  <ActivityIndicator color="white" />
                  <Text style={{ marginLeft: 10, color: 'white', fontWeight: '700' }}>Analyzing your match…</Text>
                </>
              ) : (
                <>
                  <Target size={18} color="white" />
                  <Text style={{ marginLeft: 8, color: 'white', fontWeight: '700', fontSize: 15 }}>
                    Check my match — free
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Paywall — opens when a free user taps Apply. On upgrade, complete
          the action they paid for the moment the modal closes. */}
      <PaywallModal
        visible={paywallVisible}
        onClose={() => {
          setPaywallVisible(false);
          if (selectIsPremium(usePurchasesStore.getState()) && result && !applied) {
            applyRewrites();
          }
        }}
        trigger="tailor"
      />
    </SafeAreaView>
  );
}
