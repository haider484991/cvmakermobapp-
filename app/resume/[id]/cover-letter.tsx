/**
 * AI Cover Letter (v1.10) — Pro feature.
 *
 * Paste a job posting → AI writes a 3-paragraph letter grounded in the
 * resume → user edits in place → copy or share. Generation is Pro-gated:
 * free users see the input + pitch, and the Generate tap opens the paywall
 * (trigger 'cover_letter'). If they upgrade in the modal, we generate
 * immediately — they get what they paid for without re-tapping.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Share,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildCoverLetterHtml } from '@/services/pdf/docExport';
import { Mail, Copy, Share2, Sparkles, Lock, Check, RefreshCw, FileQuestion, FileDown } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useJobStore } from '@/stores/jobStore';
import { usePremium } from '@/hooks/usePremium';
import { usePurchasesStore, selectIsPremium } from '@/stores/purchasesStore';
import { useCoverLetter } from '@/hooks/useAI';
import { PaywallModal } from '@/components/features/paywall/PaywallModal';
import { ScreenHeader, StateView } from '@/components/ui';
import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';
import { gradientColors } from '@/constants/theme';

const MIN_JD_CHARS = 60;
const MAX_JD_CHARS = 12000;

export default function CoverLetter() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { hapticEnabled } = useUIStore();
  const { isPremium } = usePremium();
  const { getResume } = useResumeStore();
  const { generateAsync, isLoading, error, reset } = useCoverLetter();

  // v1.11: pre-fill from the Jobs feed when the user came from a listing.
  const [prefilledJob] = useState(() => useJobStore.getState().consumePendingJob());
  const [jobDescription, setJobDescription] = useState(() =>
    prefilledJob ? `${prefilledJob.title} at ${prefilledJob.company}\n\n${prefilledJob.description}` : '',
  );
  const [letter, setLetter] = useState<string | null>(null);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const resume = id ? getResume(id) : null;
  const canGenerate = jobDescription.trim().length >= MIN_JD_CHARS && !isLoading;

  useEffect(() => {
    track(ANALYTICS_EVENTS.COVER_LETTER_OPENED, { is_premium: isPremium });
  }, []);

  const handleBack = useCallback(() => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router, hapticEnabled]);

  const runGenerate = useCallback(async () => {
    if (!resume) return;
    try {
      const r = await generateAsync({ resume, jobDescription: jobDescription.trim() });
      setLetter(r.letter);
      if (hapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      track(ANALYTICS_EVENTS.COVER_LETTER_GENERATED, { length: r.letter.length });
    } catch {
      // surfaced via hook error state
    }
  }, [resume, jobDescription, generateAsync, hapticEnabled]);

  const handleGenerate = useCallback(() => {
    if (!canGenerate) return;
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isPremium) {
      setPaywallVisible(true);
      return;
    }
    runGenerate();
  }, [canGenerate, isPremium, runGenerate, hapticEnabled]);

  const handleCopy = useCallback(async () => {
    if (!letter) return;
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [letter, hapticEnabled]);

  /**
   * Export the letter as a typeset PDF. Until now this screen could only copy
   * text or share a raw string, so there was no way to attach a formatted
   * cover letter to an application — despite the app already shipping an
   * HTML→PDF pipeline.
   */
  const handleExportPdf = useCallback(async () => {
    if (!letter || !resume || exportingPdf) return;
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExportingPdf(true);
    try {
      const html = buildCoverLetterHtml(letter, resume, 'letter');
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share cover letter' });
      }
      track('cover_letter_exported_pdf' as any, {});
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || 'Could not create the PDF.');
    } finally {
      setExportingPdf(false);
    }
  }, [letter, resume, exportingPdf, hapticEnabled]);

  const handleShare = useCallback(async () => {
    if (!letter) return;
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({ message: letter });
    } catch {
      // user dismissed — fine
    }
  }, [letter, hapticEnabled]);

  if (!resume) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="AI Cover Letter" onBack={handleBack} />
        <StateView
          variant="error"
          icon={FileQuestion}
          title="Resume not found"
          message="This resume may have been deleted."
          actionLabel="Go back"
          onAction={handleBack}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScreenHeader title="AI Cover Letter" onBack={handleBack} />

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          {letter ? (
            /* ---------- RESULT (editable) ---------- */
            <>
              <Animated.View entering={FadeIn.duration(250)} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
                  Edit anything below — it's your letter. Then copy it into your application or share it.
                </Text>
              </Animated.View>
              <TextInput
                value={letter}
                onChangeText={setLetter}
                multiline
                textAlignVertical="top"
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 14,
                  padding: 16,
                  minHeight: 380,
                  color: colors.text,
                  fontSize: 14,
                  lineHeight: 22,
                }}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <Pressable
                  onPress={handleCopy}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 13,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                  }}
                >
                  {copied ? <Check size={16} color="white" strokeWidth={3} /> : <Copy size={16} color="white" />}
                  <Text style={{ color: 'white', fontWeight: '700', marginLeft: 7 }}>{copied ? 'Copied!' : 'Copy'}</Text>
                </Pressable>
                <Pressable
                  onPress={handleShare}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 13,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                  }}
                >
                  <Share2 size={16} color={colors.text} />
                  <Text style={{ color: colors.text, fontWeight: '600', marginLeft: 7 }}>Share</Text>
                </Pressable>
                <Pressable
                  onPress={handleExportPdf}
                  disabled={exportingPdf}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 13,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    opacity: exportingPdf ? 0.6 : 1,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Export cover letter as PDF"
                >
                  {exportingPdf ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <FileDown size={16} color={colors.text} />
                  )}
                  <Text style={{ color: colors.text, fontWeight: '600', marginLeft: 7 }}>PDF</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setLetter(null);
                    reset();
                  }}
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 14,
                    borderRadius: 13,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <RefreshCw size={16} color={colors.textSecondary} />
                </Pressable>
              </View>
            </>
          ) : (
            /* ---------- INPUT ---------- */
            <>
              <Animated.View entering={FadeInUp.duration(300)}>
                <LinearGradient
                  colors={gradientColors.accent}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ borderRadius: 16, padding: 20, marginBottom: 18 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Mail size={20} color="white" />
                    <Text style={{ marginLeft: 8, color: 'white', fontSize: 16, fontWeight: '700' }}>
                      Cover letter, written for you
                    </Text>
                    <View style={{ marginLeft: 8, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                      <Text style={{ color: 'white', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>PRO</Text>
                    </View>
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 13, lineHeight: 18 }}>
                    Paste the job posting. AI writes a personal, 3-paragraph letter from your resume —
                    your real achievements mapped to what they're asking for. No clichés.
                  </Text>
                </LinearGradient>
              </Animated.View>

              <TextInput
                value={jobDescription}
                onChangeText={(t) => {
                  if (t.length <= MAX_JD_CHARS) setJobDescription(t);
                }}
                placeholder="Paste the job posting here…"
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

        {/* Generate CTA (input state only) */}
        {!letter && (
          <View style={{ padding: 16, paddingBottom: 24, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Pressable
              onPress={handleGenerate}
              disabled={!canGenerate}
              style={{
                paddingVertical: 16,
                borderRadius: 14,
                backgroundColor: canGenerate ? colors.primary : colors.border,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
              }}
            >
              {isLoading ? (
                <>
                  <ActivityIndicator color="white" />
                  <Text style={{ marginLeft: 10, color: 'white', fontWeight: '700' }}>Writing your letter…</Text>
                </>
              ) : (
                <>
                  {isPremium ? <Sparkles size={17} color="white" /> : <Lock size={15} color="white" />}
                  <Text style={{ marginLeft: 8, color: 'white', fontWeight: '700', fontSize: 15 }}>
                    {isPremium ? 'Write my cover letter' : 'Write with Pro'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Paywall — if they upgrade inside, generate immediately. */}
      <PaywallModal
        visible={paywallVisible}
        onClose={() => {
          setPaywallVisible(false);
          if (selectIsPremium(usePurchasesStore.getState()) && !letter && canGenerate) {
            runGenerate();
          }
        }}
        trigger="cover_letter"
      />
    </SafeAreaView>
  );
}
