import { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Modal, Alert, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import WebView from 'react-native-webview';
import { useTheme } from '@/hooks/useTheme';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUIStore } from '@/stores/uiStore';
import { useScoreResume } from '@/hooks/useAI';
import { usePDFExport } from '@/hooks/usePDFExport';
import { useDownloadAd } from '@/hooks/useDownloadAd';
import { AIScoreCard } from '@/components/features/ai-assistant';
import { Button } from '@/components/ui';
import { TemplateSwitcher, ColorPicker } from '@/components/features/templates';
import { generatePremiumHTML } from '@/services/pdf/premiumHtmlEngine';
import { runAtsRoundTrip, type AtsRoundTripResult } from '@/services/ai/atsRoundTrip';
import { track } from '@/services/analytics/analytics';
import { ArrowLeft, Download, Share2, Sparkles, X, FileText, Settings, Play, ScanLine, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

/**
 * Resume preview rendered through the SAME engine as the PDF export.
 *
 * Why a WebView and not the in-app RN template component?
 *   - Preview must match the PDF output EXACTLY. Two separate render
 *     pipelines (RN templates + HTML engine) was the v1.8 architecture
 *     and drift was inevitable — fonts, spacing, page breaks all wrong.
 *   - The HTML engine already implements CSS page-break-inside:avoid,
 *     orphan/widow control, @page sizing per paper. By rendering the
 *     HTML in a WebView, the user SEES those rules apply.
 *   - The engine's preview mode adds paper-sheet chrome (gray background,
 *     white page card with shadow) and a JS paginator that splits long
 *     resumes into multiple page cards.
 *
 * Height: the WebView sizes itself to its full content height (no inner
 * scroll) — the outer ScrollView handles scrolling through multiple pages
 * naturally.
 */
function ResumeWebViewPreview({
  resumeId,
  templateId,
}: {
  resumeId: string;
  templateId: string;
}) {
  const { getResume } = useResumeStore();
  const { getTemplate } = useTemplateStore();
  const resume = getResume(resumeId);
  const template = getTemplate(templateId);
  const [contentHeight, setContentHeight] = useState(900); // sensible starting height before first measure

  // The preview card spans the screen minus the parent ScrollView's
  // horizontal padding (px-4 = 16px each side = 32px). We feed this width
  // to the HTML engine so it computes a viewport scale that fits the full
  // 816px-wide page onto the screen (instead of rendering 1:1 and showing
  // only the left portion — the v1.9.0 zoom bug).
  const { width: screenWidth } = useWindowDimensions();
  const containerWidth = Math.max(280, screenWidth - 32);
  // Letter paper is 8.5in × 96dpi = 816px. Scale to fit the container.
  const PAPER_W = 816;
  const fitScale = Math.min(1, containerWidth / PAPER_W);

  const html = useMemo(() => {
    if (!resume || !template) return '';
    return generatePremiumHTML(resume, template, {
      paperSize: 'letter',
      mode: 'preview',
      previewWidthPx: containerWidth,
      accentColor: resume.accentColor,
    });
  }, [resume, template, containerWidth, resume?.accentColor]);

  // Injected after document is ready: posts the rendered body height back
  // to RN so we can size the WebView container. Re-fires on font load
  // because Inter's metrics differ from the system fallback enough to
  // change layout height.
  const injected = `
    (function () {
      function postHeight() {
        try {
          var h = document.body.scrollHeight;
          window.ReactNativeWebView.postMessage(String(h));
        } catch (e) {}
      }
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { setTimeout(postHeight, 50); });
      }
      window.addEventListener('load', function () { setTimeout(postHeight, 100); });
      // The paginator may add new page divs after layout — re-measure
      // a moment later to capture them.
      setTimeout(postHeight, 600);
    })();
    true;
  `;

  if (!resume || !template || !html) {
    return (
      <View style={{ minHeight: 600, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#E5E7EB', // matches preview-chrome bg in HTML engine
        minHeight: 600,
        height: contentHeight,
      }}
    >
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        injectedJavaScript={injected}
        onMessage={(event) => {
          const rawH = parseInt(event.nativeEvent.data, 10);
          if (!isNaN(rawH) && rawH > 100) {
            // The WebView renders the 816px-wide layout scaled down by
            // fitScale to fit the screen, so the VISUAL height is
            // scrollHeight × fitScale. Size the RN container to that, plus
            // a little breathing room. Clamp so a runaway height can't
            // blow up the layout.
            const visualH = rawH * fitScale + 24;
            setContentHeight(Math.min(visualH, 12000));
          }
        }}
        // Don't let the WebView capture scroll — we want the outer
        // ScrollView to drive scrolling through multiple page cards.
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        // Performance hints for resume-sized docs
        cacheEnabled={false}
        startInLoadingState
        renderLoading={() => (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
          </View>
        )}
        style={{ backgroundColor: '#E5E7EB' }}
      />
    </View>
  );
}

export default function PreviewResume() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { getResume } = useResumeStore();
  const { selectedTemplateId, getTemplate } = useTemplateStore();
  const { hapticEnabled } = useUIStore();

  const resume = getResume(id);

  // Get the selected template styles
  const template = useMemo(() => {
    return getTemplate(selectedTemplateId || 'ats-classic');
  }, [selectedTemplateId, getTemplate]);

  const templateStyles = template?.styles;

  // PDF Export hook
  const {
    isGenerating,
    downloadPDF,
  } = usePDFExport({ isPremium: false });

  // Rewarded Ad hook
  const { loaded: adLoaded, showAd } = useDownloadAd();

  // AI Score hook
  const {
    scoreResumeAsync,
    isLoading: scoreLoading,
    data: scoreData,
    reset: resetScore,
  } = useScoreResume();

  // State
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showJobDescriptionInput, setShowJobDescriptionInput] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [atsRunning, setAtsRunning] = useState(false);
  const [atsResult, setAtsResult] = useState<AtsRoundTripResult | null>(null);

  const handleBack = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  const handleExportOptions = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push(`/resume/${id}/export`);
  };

  // Direct download with ads
  /**
   * Run the ATS round trip: export the PDF, re-parse it, diff the result.
   * Costs one AI call (same parser as resume import), so it's user-triggered
   * rather than automatic.
   */
  const handleAtsTest = useCallback(async () => {
    if (!resume || atsRunning) return;
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAtsRunning(true);
    try {
      const result = await runAtsRoundTrip(resume, template, 'letter');
      setAtsResult(result);
      track('ats_roundtrip_completed' as any, {
        score: result.score,
        issues: result.issues.length,
        template_id: template?.id,
      });
      if (hapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Could not run the test', e?.message || 'Please try again.');
      track('ats_roundtrip_failed' as any, { error: String(e?.message).slice(0, 200) });
    } finally {
      setAtsRunning(false);
    }
  }, [resume, template, atsRunning, hapticEnabled]);

  /** Colour for the recovery score — green ≥90, amber ≥70, red below. */
  const atsTone = useCallback(
    (score: number) => (score >= 90 ? colors.success : score >= 70 ? colors.warning : colors.error),
    [colors],
  );

  const handleDownload = useCallback(async () => {
    if (!id) return;

    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // If ad is loaded, show it first
    if (adLoaded) {
      const earned = await showAd();
      if (earned) {
        // User watched the full ad, proceed with download
        const result = await downloadPDF(id, { paperSize: 'letter' });
        if (result.success) {
          setDownloadSuccess(true);
          if (hapticEnabled) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          Alert.alert('Success', 'Resume saved to your device!');
          setTimeout(() => setDownloadSuccess(false), 3000);
        }
      } else {
        Alert.alert(
          'Ad Not Completed',
          'Please watch the full ad to download your resume for free.',
          [{ text: 'OK' }]
        );
      }
    } else {
      // Ad not loaded, proceed directly
      const result = await downloadPDF(id, { paperSize: 'letter' });
      if (result.success) {
        setDownloadSuccess(true);
        if (hapticEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        Alert.alert('Success', 'Resume saved to your device!');
        setTimeout(() => setDownloadSuccess(false), 3000);
      }
    }
  }, [id, hapticEnabled, adLoaded, showAd, downloadPDF]);

  const handleGetScore = useCallback(async () => {
    if (!resume) return;
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      await scoreResumeAsync({
        resume,
        jobDescription: jobDescription.trim() || undefined,
      });
      setShowScoreModal(true);
      setShowJobDescriptionInput(false);
    } catch (error) {
      console.error('Failed to score resume:', error);
    }
  }, [resume, jobDescription, scoreResumeAsync, hapticEnabled]);

  const handleShowJobDescriptionInput = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowJobDescriptionInput(true);
  };

  const handleDismissScore = useCallback(() => {
    setShowScoreModal(false);
    resetScore();
    setJobDescription('');
  }, [resetScore]);

  const handleRetryScore = useCallback(async () => {
    if (!resume) return;
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      await scoreResumeAsync({
        resume,
        jobDescription: jobDescription.trim() || undefined,
      });
    } catch (error) {
      console.error('Failed to score resume:', error);
    }
  }, [resume, jobDescription, scoreResumeAsync, hapticEnabled]);

  if (!resume) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: colors.background }}
      >
        <Text style={{ color: colors.textSecondary }}>Resume not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: colors.border }}
      >
        <Pressable onPress={handleBack} className="p-2">
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text className="text-lg font-semibold" style={{ color: colors.text }}>
          Preview
        </Text>
        <Pressable onPress={handleExportOptions} className="p-2">
          <Settings size={22} color={colors.primary} />
        </Pressable>
      </View>

      {/* AI Score Button */}
      {!showJobDescriptionInput && !scoreLoading && (
        <Animated.View entering={FadeIn.delay(200)} className="mx-4 mt-4">
          <Pressable
            onPress={handleShowJobDescriptionInput}
            className="flex-row items-center justify-center p-4 rounded-xl"
            style={{
              backgroundColor: colors.primary + '10',
              borderWidth: 1,
              borderColor: colors.primary + '30',
            }}
          >
            <View
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: colors.primary }}
            >
              <Sparkles size={20} color="white" />
            </View>
            <View className="flex-1">
              <Text className="font-semibold" style={{ color: colors.primary }}>
                Get AI Score
              </Text>
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                Analyze your resume with AI
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      )}

      {/* Job Description Input */}
      {showJobDescriptionInput && !scoreLoading && (
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          className="mx-4 mt-4 p-4 rounded-xl"
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View className="flex-row justify-between items-center mb-3">
            <View className="flex-row items-center">
              <FileText size={18} color={colors.primary} />
              <Text className="ml-2 font-semibold" style={{ color: colors.text }}>
                Target Job (Optional)
              </Text>
            </View>
            <Pressable
              onPress={() => setShowJobDescriptionInput(false)}
              className="p-1"
            >
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <TextInput
            value={jobDescription}
            onChangeText={setJobDescription}
            placeholder="Paste the job description here for tailored analysis..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="p-3 rounded-xl mb-3"
            style={{
              backgroundColor: colors.background,
              color: colors.text,
              borderWidth: 1,
              borderColor: colors.border,
              minHeight: 100,
            }}
          />

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => {
                setJobDescription('');
                handleGetScore();
              }}
              className="flex-1 py-3 rounded-xl items-center"
              style={{ backgroundColor: colors.surfaceSecondary }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '500' }}>
                Skip
              </Text>
            </Pressable>
            <Pressable
              onPress={handleGetScore}
              className="flex-1 py-3 rounded-xl items-center flex-row justify-center"
              style={{ backgroundColor: colors.primary }}
            >
              <Sparkles size={16} color="white" />
              <Text className="ml-2" style={{ color: 'white', fontWeight: '600' }}>
                Analyze
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* Loading State */}
      {scoreLoading && (
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          className="mx-4 mt-4 p-6 rounded-xl items-center"
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            className="mt-3 text-center font-medium"
            style={{ color: colors.text }}
          >
            Analyzing your resume...
          </Text>
          <Text
            className="mt-1 text-center text-sm"
            style={{ color: colors.textSecondary }}
          >
            This may take a few seconds
          </Text>
        </Animated.View>
      )}

      {/* Template Switcher — swap templates without leaving preview. */}
      <View style={{ marginTop: 12 }}>
        <TemplateSwitcher />
      </View>

      {/* Color picker — re-color the active template. Persists on the
          resume + flows into both preview and PDF export. */}
      <View style={{ marginTop: 14 }}>
        <ColorPicker
          value={resume.accentColor}
          onChange={(hex) => {
            if (hapticEnabled) Haptics.selectionAsync();
            useResumeStore.getState().setAccentColor(id, hex);
          }}
        />
      </View>

      {/* Preview Content */}
      <ScrollView
        className="flex-1 px-4 py-4"
        showsVerticalScrollIndicator={false}
      >
        {/* Template Name Badge */}
        {template && (
          <View className="flex-row items-center justify-center mb-3">
            <View
              className="px-3 py-1.5 rounded-full"
              style={{ backgroundColor: templateStyles?.colors.primary + '15' }}
            >
              <Text
                className="text-xs font-medium"
                style={{ color: templateStyles?.colors.primary }}
              >
                {template.name} Template
              </Text>
            </View>
          </View>
        )}

        {/* ATS round-trip test.
            Unlike a keyword score or an LLM opinion, this exports the real
            PDF, re-parses it, and reports what a scanner actually loses. */}
        <View
          className="mb-3 rounded-2xl overflow-hidden"
          style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
        >
          <Pressable
            onPress={handleAtsTest}
            disabled={atsRunning}
            className="p-4 flex-row items-center"
            accessibilityRole="button"
            accessibilityLabel="Run the ATS scan test"
          >
            <View
              className="w-11 h-11 rounded-xl items-center justify-center mr-3"
              style={{ backgroundColor: colors.primary + '15' }}
            >
              {atsRunning ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <ScanLine size={22} color={colors.primary} />
              )}
            </View>
            <View className="flex-1">
              <Text className="font-bold" style={{ color: colors.text }}>
                {atsRunning ? 'Scanning your PDF…' : 'Test how an ATS reads this'}
              </Text>
              <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                {atsRunning
                  ? 'Exporting, then reading it back like a recruiter’s system would'
                  : 'We export your PDF, read it back, and show what gets lost'}
              </Text>
            </View>
            {!atsRunning && !atsResult && <ChevronRight size={20} color={colors.textMuted} />}
          </Pressable>

          {atsResult && (
            <Animated.View entering={FadeIn.duration(250)} className="px-4 pb-4">
              <View
                className="rounded-xl p-3 mb-3 flex-row items-center"
                style={{ backgroundColor: atsTone(atsResult.score) + '12' }}
              >
                <Text style={{ fontSize: 30, fontWeight: '800', color: atsTone(atsResult.score) }}>
                  {atsResult.score}%
                </Text>
                <Text className="ml-3 flex-1 text-xs" style={{ color: colors.textSecondary, lineHeight: 17 }}>
                  of your content survived the scan.{' '}
                  {atsResult.recovered.bullets[1] > 0 &&
                    `${atsResult.recovered.bullets[0]}/${atsResult.recovered.bullets[1]} bullets, `}
                  {atsResult.recovered.skills[1] > 0 &&
                    `${atsResult.recovered.skills[0]}/${atsResult.recovered.skills[1]} skills readable.`}
                </Text>
              </View>

              {atsResult.issues.slice(0, 5).map((issue, i) => (
                <View key={i} className="flex-row mb-2.5">
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      marginTop: 6,
                      marginRight: 9,
                      backgroundColor:
                        issue.severity === 'critical'
                          ? colors.error
                          : issue.severity === 'warning'
                            ? colors.warning
                            : colors.success,
                    }}
                  />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold" style={{ color: colors.text }}>
                      {issue.title}
                    </Text>
                    <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary, lineHeight: 17 }}>
                      {issue.detail}
                    </Text>
                  </View>
                </View>
              ))}

              <Pressable onPress={handleAtsTest} className="mt-1 py-2">
                <Text className="text-xs font-semibold" style={{ color: colors.primary }}>
                  Re-run test
                </Text>
              </Pressable>
            </Animated.View>
          )}
        </View>

        {/* Resume Preview — WebView rendering the EXACT HTML the PDF
            export will produce. Preview = Export by construction:
              - Same fonts (Inter embedded as base64 in the HTML head)
              - Same layouts (the rb-page CSS engine drives both surfaces)
              - Same page-break rules (page-break-inside: avoid on sections,
                orphans/widows = 3) — visible here, applied in the PDF
              - Multi-page resumes paginate into separate page cards via
                the inline JS paginator built into the engine, so the user
                sees real "Page 1 / Page 2 / ..." separation
            Letter is the default — export screen lets the user switch. */}
        {template && (
          <ResumeWebViewPreview
            resumeId={id}
            templateId={template.id}
          />
        )}

        <View className="h-8" />
      </ScrollView>

      {/* Bottom Action Buttons */}
      <View
        className="px-4 py-4 border-t"
        style={{ borderColor: colors.border, backgroundColor: colors.surface }}
      >
        <View className="flex-row gap-3">
          {/* Download Button with Ad */}
          <Pressable
            onPress={handleDownload}
            disabled={isGenerating}
            className="flex-1 py-4 rounded-xl flex-row items-center justify-center"
            style={{
              backgroundColor: adLoaded ? colors.warning : colors.primary,
            }}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color="white" />
            ) : downloadSuccess ? (
              <>
                <Text className="text-white font-semibold">Downloaded!</Text>
              </>
            ) : (
              <>
                {adLoaded ? (
                  <Play size={18} color="white" />
                ) : (
                  <Download size={18} color="white" />
                )}
                <Text className="text-white font-semibold ml-2">
                  {adLoaded ? 'Watch Ad & Download' : 'Download PDF'}
                </Text>
              </>
            )}
          </Pressable>

          {/* More Options Button */}
          <Pressable
            onPress={handleExportOptions}
            className="py-4 px-5 rounded-xl items-center justify-center"
            style={{
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Share2 size={20} color={colors.text} />
          </Pressable>
        </View>

        {adLoaded && (
          <Text
            className="text-center text-xs mt-2"
            style={{ color: colors.textSecondary }}
          >
            Watch a short ad to download for free
          </Text>
        )}
      </View>

      {/* Score Modal */}
      <Modal
        visible={showScoreModal && !!scoreData}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleDismissScore}
      >
        <SafeAreaView
          className="flex-1"
          style={{ backgroundColor: colors.background }}
        >
          {/* Modal Header */}
          <View
            className="flex-row items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: colors.border }}
          >
            <Pressable onPress={handleDismissScore} className="p-2">
              <X size={24} color={colors.text} />
            </Pressable>
            <Text className="text-lg font-semibold" style={{ color: colors.text }}>
              Resume Analysis
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Score Content */}
          <ScrollView
            className="flex-1 px-4 py-4"
            showsVerticalScrollIndicator={false}
          >
            {scoreData && (
              <AIScoreCard
                score={scoreData}
                onDismiss={handleDismissScore}
                onRetry={handleRetryScore}
                dismissable={false}
                showDetails={true}
              />
            )}
            <View className="h-8" />
          </ScrollView>

          {/* Close Button */}
          <View
            className="px-4 py-4 border-t"
            style={{ borderColor: colors.border, backgroundColor: colors.surface }}
          >
            <Button onPress={handleDismissScore} fullWidth>
              Close
            </Button>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
