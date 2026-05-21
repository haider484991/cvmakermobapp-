import { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Modal, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUIStore } from '@/stores/uiStore';
import { useScoreResume } from '@/hooks/useAI';
import { usePDFExport } from '@/hooks/usePDFExport';
import { useDownloadAd } from '@/hooks/useDownloadAd';
import { AIScoreCard } from '@/components/features/ai-assistant';
import { Button } from '@/components/ui';
import { getTemplateComponent } from '@/components/templates';
import { TemplateSwitcher } from '@/components/features/templates';
import { ArrowLeft, Download, Share2, Sparkles, X, FileText, Settings, Play } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

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

        {/* Resume Preview Card - Using Template Component */}
        <View
          className="rounded-xl overflow-hidden"
          style={{
            backgroundColor: templateStyles?.colors.background || 'white',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 5,
            minHeight: 600,
          }}
        >
          {template && (
            (() => {
              const TemplateComponent = getTemplateComponent(template.id);
              return <TemplateComponent resume={resume} template={template} />;
            })()
          )}
        </View>

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
