import { useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUIStore } from '@/stores/uiStore';
import { usePDFExport } from '@/hooks/usePDFExport';
import { useDownloadAd } from '@/hooks/useDownloadAd';
import { Button } from '@/components/ui';
import {
  ArrowLeft,
  FileText,
  Share2,
  Download,
  Check,
  Eye,
  Palette,
  ChevronRight,
  AlertCircle,
  Play,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { PaperSize } from '@/services/pdf';

export default function ExportResume() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { getResume } = useResumeStore();
  const { getTemplate, selectedTemplateId, templates } = useTemplateStore();
  const { hapticEnabled } = useUIStore();

  // PDF Export hook
  const {
    isGenerating,
    progress,
    error,
    exportPDF,
    sharePDF,
    downloadPDF,
    preview,
    clearError,
  } = usePDFExport({ isPremium: false }); // TODO: Get from subscription store

  // Rewarded Ad hook for download/share actions
  const { loaded: adLoaded, loading: adLoading, showAd } = useDownloadAd();

  const [paperSize, setPaperSize] = useState<PaperSize>('letter');
  const [exportSuccess, setExportSuccess] = useState(false);

  const resume = getResume(id!);
  const selectedTemplate = selectedTemplateId ? getTemplate(selectedTemplateId) : templates[0];

  const handleBack = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  const handleGoToTemplates = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Pass returnTo so templates page knows to navigate back after selection
    router.push(`/(main)/templates?returnTo=/resume/${id}/export`);
  };

  const handlePreview = useCallback(async () => {
    if (!id) return;

    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // If ad is loaded, show it first
    if (adLoaded) {
      const earned = await showAd();
      if (earned) {
        // User watched the full ad, proceed with preview
        await preview(id, { paperSize });
      } else {
        // User closed ad early, show a message
        Alert.alert(
          'Ad Not Completed',
          'Please watch the full ad to preview your resume.',
          [{ text: 'OK' }]
        );
      }
    } else if (adLoading) {
      // Ad still loading, ask user to wait
      Alert.alert(
        'Please Wait',
        'Ad is loading... Please try again in a moment.',
        [{ text: 'OK' }]
      );
    } else {
      // Ad failed to load, allow preview with warning
      Alert.alert(
        'Ad Unavailable',
        'Unable to load ad. You can still preview your resume.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Preview Anyway', onPress: () => preview(id, { paperSize }) }
        ]
      );
    }
  }, [id, preview, paperSize, hapticEnabled, adLoaded, adLoading, showAd]);

  // Core export function (called after ad or directly)
  const performExportPDF = useCallback(async () => {
    if (!id) return;

    try {
      // Use downloadPDF to save to device storage
      const result = await downloadPDF(id, { paperSize });

      if (result.success) {
        setExportSuccess(true);
        if (hapticEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        Alert.alert('Success', 'Resume saved to your device!');
        setTimeout(() => setExportSuccess(false), 3000);
      } else {
        // Show error to user
        if (hapticEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        Alert.alert(
          'Download Failed',
          result.error || 'Failed to download your resume. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      // Handle unexpected errors
      if (hapticEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
      console.error('[Export] Unexpected error:', err);
    }
  }, [id, downloadPDF, paperSize, hapticEnabled]);

  const handleExportPDF = useCallback(async () => {
    if (!id) return;

    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Ad is required for download
    if (adLoaded) {
      const earned = await showAd();
      if (earned) {
        // User watched the full ad, proceed with download
        await performExportPDF();
      } else {
        // User closed ad early, show a message
        Alert.alert(
          'Ad Not Completed',
          'Please watch the full ad to download your resume for free.',
          [{ text: 'OK' }]
        );
      }
    } else if (adLoading) {
      // Ad still loading, ask user to wait
      Alert.alert(
        'Please Wait',
        'Ad is loading... Please try again in a moment.',
        [{ text: 'OK' }]
      );
    } else {
      // Ad failed to load, allow download with warning
      Alert.alert(
        'Ad Unavailable',
        'Unable to load ad. You can still download your resume.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Download Anyway', onPress: () => performExportPDF() }
        ]
      );
    }
  }, [id, hapticEnabled, adLoaded, adLoading, showAd, performExportPDF]);

  // Core share function (called after ad or directly)
  const performSharePDF = useCallback(async () => {
    if (!id) return;

    try {
      const result = await sharePDF(id, { paperSize });

      if (result.success) {
        setExportSuccess(true);
        if (hapticEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setTimeout(() => setExportSuccess(false), 3000);
      } else {
        // Show error to user
        if (hapticEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        Alert.alert(
          'Share Failed',
          result.error || 'Failed to share your resume. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      // Handle unexpected errors
      if (hapticEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
      console.error('[Export] Share unexpected error:', err);
    }
  }, [id, sharePDF, paperSize, hapticEnabled]);

  const handleSharePDF = useCallback(async () => {
    if (!id) return;

    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Ad is required for share
    if (adLoaded) {
      const earned = await showAd();
      if (earned) {
        // User watched the full ad, proceed with share
        await performSharePDF();
      } else {
        // User closed ad early, show a message
        Alert.alert(
          'Ad Not Completed',
          'Please watch the full ad to share your resume for free.',
          [{ text: 'OK' }]
        );
      }
    } else if (adLoading) {
      // Ad still loading, ask user to wait
      Alert.alert(
        'Please Wait',
        'Ad is loading... Please try again in a moment.',
        [{ text: 'OK' }]
      );
    } else {
      // Ad failed to load, allow share with warning
      Alert.alert(
        'Ad Unavailable',
        'Unable to load ad. You can still share your resume.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Share Anyway', onPress: () => performSharePDF() }
        ]
      );
    }
  }, [id, hapticEnabled, adLoaded, adLoading, showAd, performSharePDF]);

  const handlePaperSizeChange = (size: PaperSize) => {
    if (hapticEnabled) {
      Haptics.selectionAsync();
    }
    setPaperSize(size);
  };

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
        className="flex-row items-center px-4 py-3 border-b"
        style={{ borderColor: colors.border }}
      >
        <Pressable onPress={handleBack} className="p-2 mr-2">
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text className="text-xl font-semibold" style={{ color: colors.text }}>
          Export Resume
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 py-6">
          {/* Error Message */}
          {error && (
            <Animated.View
              entering={FadeIn.duration(200)}
              className="mb-4 p-3 rounded-xl flex-row items-center"
              style={{ backgroundColor: colors.error + '15' }}
            >
              <AlertCircle size={20} color={colors.error} />
              <Text className="ml-2 flex-1" style={{ color: colors.error }}>
                {error}
              </Text>
              <Pressable onPress={clearError}>
                <Text style={{ color: colors.error, fontWeight: '600' }}>Dismiss</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Progress Message */}
          {isGenerating && progress && (
            <Animated.View
              entering={FadeIn.duration(200)}
              className="mb-4 p-3 rounded-xl flex-row items-center"
              style={{ backgroundColor: colors.primary + '10' }}
            >
              <ActivityIndicator size="small" color={colors.primary} />
              <Text className="ml-2" style={{ color: colors.primary }}>
                {progress}
              </Text>
            </Animated.View>
          )}

          {/* Current Template */}
          <Animated.View entering={FadeInUp.delay(100)}>
            <Text
              className="text-sm font-medium mb-2"
              style={{ color: colors.textSecondary }}
            >
              CURRENT TEMPLATE
            </Text>
            <Pressable
              onPress={handleGoToTemplates}
              className="p-4 rounded-xl mb-6 flex-row items-center"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
            >
              <View
                className="w-12 h-12 rounded-lg items-center justify-center mr-3"
                style={{ backgroundColor: selectedTemplate?.previewColor + '15' }}
              >
                <Palette size={24} color={selectedTemplate?.previewColor} />
              </View>
              <View className="flex-1">
                <Text className="font-semibold" style={{ color: colors.text }}>
                  {selectedTemplate?.name || 'ATS Classic'}
                </Text>
                <Text className="text-sm" style={{ color: colors.textSecondary }}>
                  {selectedTemplate?.description || 'Clean ATS-optimized template'}
                </Text>
              </View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </Pressable>
          </Animated.View>

          {/* Paper Size */}
          <Animated.View entering={FadeInUp.delay(150)}>
            <Text
              className="text-sm font-medium mb-2"
              style={{ color: colors.textSecondary }}
            >
              PAPER SIZE
            </Text>
            <View className="flex-row gap-3 mb-6">
              {(['letter', 'a4'] as PaperSize[]).map((size) => (
                <Pressable
                  key={size}
                  onPress={() => handlePaperSizeChange(size)}
                  className="flex-1 p-4 rounded-xl items-center"
                  style={{
                    backgroundColor: paperSize === size ? colors.primary + '10' : colors.surface,
                    borderWidth: 2,
                    borderColor: paperSize === size ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    className="font-semibold"
                    style={{ color: paperSize === size ? colors.primary : colors.text }}
                  >
                    {size === 'letter' ? 'US Letter' : 'A4'}
                  </Text>
                  <Text
                    className="text-xs mt-1"
                    style={{ color: colors.textSecondary }}
                  >
                    {size === 'letter' ? '8.5" × 11"' : '210 × 297mm'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Export Options */}
          <Animated.View entering={FadeInUp.delay(200)}>
            <Text
              className="text-sm font-medium mb-2"
              style={{ color: colors.textSecondary }}
            >
              EXPORT OPTIONS
            </Text>
          </Animated.View>

          {/* Preview Button */}
          <Animated.View entering={FadeInUp.delay(250)}>
            <Pressable
              onPress={handlePreview}
              disabled={isGenerating || adLoading}
              className="p-4 rounded-xl mb-3 flex-row items-center"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 2,
                borderColor: adLoaded ? colors.warning : colors.border,
                opacity: adLoading ? 0.7 : 1,
              }}
            >
              <View
                className="w-12 h-12 rounded-xl items-center justify-center mr-3"
                style={{ backgroundColor: adLoaded ? colors.warning : colors.textSecondary + '15' }}
              >
                {adLoading ? (
                  <ActivityIndicator color={colors.textSecondary} size="small" />
                ) : adLoaded ? (
                  <Play size={24} color="white" />
                ) : (
                  <Eye size={24} color={colors.textSecondary} />
                )}
              </View>
              <View className="flex-1">
                <Text className="font-semibold" style={{ color: colors.text }}>
                  {adLoaded ? 'Watch Ad to Preview' : adLoading ? 'Loading Ad...' : 'Preview PDF'}
                </Text>
                <Text className="text-sm" style={{ color: colors.textSecondary }}>
                  {adLoaded ? 'Watch a short ad to preview' : 'See how your resume will look'}
                </Text>
              </View>
              {adLoaded && (
                <View
                  className="px-2 py-1 rounded-full"
                  style={{ backgroundColor: colors.warning + '20' }}
                >
                  <Text className="text-xs font-semibold" style={{ color: colors.warning }}>
                    FREE
                  </Text>
                </View>
              )}
            </Pressable>
          </Animated.View>

          {/* Download PDF */}
          <Animated.View entering={FadeInUp.delay(300)}>
            <Pressable
              onPress={handleExportPDF}
              disabled={isGenerating || adLoading}
              className="p-4 rounded-xl mb-3 flex-row items-center"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 2,
                borderColor: adLoaded ? colors.warning : colors.border,
                opacity: adLoading ? 0.7 : 1,
              }}
            >
              <View
                className="w-12 h-12 rounded-xl items-center justify-center mr-3"
                style={{ backgroundColor: adLoaded ? colors.warning : colors.primary }}
              >
                {isGenerating ? (
                  <ActivityIndicator color="white" size="small" />
                ) : exportSuccess ? (
                  <Check size={24} color="white" />
                ) : adLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : adLoaded ? (
                  <Play size={24} color="white" />
                ) : (
                  <Download size={24} color="white" />
                )}
              </View>
              <View className="flex-1">
                <Text className="font-semibold" style={{ color: colors.text }}>
                  {adLoaded ? 'Watch Ad to Download' : adLoading ? 'Loading Ad...' : 'Download PDF'}
                </Text>
                <Text className="text-sm" style={{ color: colors.textSecondary }}>
                  {adLoaded ? 'Watch a short ad to download for free' : adLoading ? 'Please wait...' : 'Watch ad required'}
                </Text>
              </View>
              {adLoaded && (
                <View
                  className="px-2 py-1 rounded-full"
                  style={{ backgroundColor: colors.warning + '20' }}
                >
                  <Text className="text-xs font-semibold" style={{ color: colors.warning }}>
                    FREE
                  </Text>
                </View>
              )}
            </Pressable>
          </Animated.View>

          {/* Share PDF */}
          <Animated.View entering={FadeInUp.delay(350)}>
            <Pressable
              onPress={handleSharePDF}
              disabled={isGenerating}
              className="p-4 rounded-xl mb-3 flex-row items-center"
              style={{
                backgroundColor: colors.surface,
                borderWidth: adLoaded ? 2 : 0,
                borderColor: adLoaded ? colors.warning : 'transparent',
              }}
            >
              <View
                className="w-12 h-12 rounded-xl items-center justify-center mr-3"
                style={{ backgroundColor: adLoaded ? colors.warning : colors.success + '15' }}
              >
                {adLoaded ? (
                  <Play size={24} color="white" />
                ) : (
                  <Share2 size={24} color={colors.success} />
                )}
              </View>
              <View className="flex-1">
                <Text className="font-semibold" style={{ color: colors.text }}>
                  {adLoaded ? 'Watch Ad to Share' : 'Share Resume'}
                </Text>
                <Text className="text-sm" style={{ color: colors.textSecondary }}>
                  {adLoaded
                    ? 'Watch a short ad to share for free'
                    : 'Send via email, messages, or other apps'}
                </Text>
              </View>
              {adLoaded && (
                <View
                  className="px-2 py-1 rounded-full"
                  style={{ backgroundColor: colors.warning + '20' }}
                >
                  <Text className="text-xs font-semibold" style={{ color: colors.warning }}>
                    FREE
                  </Text>
                </View>
              )}
            </Pressable>
          </Animated.View>

          {/* Watermark Notice */}
          <Animated.View
            entering={FadeInUp.delay(400)}
            className="mt-4 p-4 rounded-xl"
            style={{ backgroundColor: colors.warning + '10' }}
          >
            <View className="flex-row items-start">
              <AlertCircle size={18} color={colors.warning} style={{ marginTop: 2 }} />
              <View className="ml-2 flex-1">
                <Text className="font-medium" style={{ color: colors.warning }}>
                  Free Plan
                </Text>
                <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                  Your resume will include a small watermark. Upgrade to Premium to remove it and
                  unlock all templates.
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Tips */}
          <Animated.View
            entering={FadeInUp.delay(450)}
            className="mt-4 p-4 rounded-xl"
            style={{ backgroundColor: colors.primary + '08' }}
          >
            <Text className="font-semibold mb-2" style={{ color: colors.primary }}>
              Export Tips
            </Text>
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              • PDF format is best for job applications{'\n'}
              • US Letter is common in North America{'\n'}
              • A4 is standard in Europe and most other countries{'\n'}
              • Always proofread before sending
            </Text>
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
