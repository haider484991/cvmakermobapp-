import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Alert, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useResumeStore } from '@/stores/resumeStore';
import { useUIStore } from '@/stores/uiStore';
import { useLinkedIn } from '@/hooks/useLinkedIn';
import { useGenerateSummary, useEnhanceBullets, useSuggestSkills, useScoreResume } from '@/hooks/useAI';
import { buildContextFromResume } from '@/services/ai/resumeAI';
import { AIFloatingButton } from '@/components/features/ai-assistant';
import { ResumeScoreInline } from '@/components/features/scoring';
import { NextStepCard } from '@/components/features/resume';
import { LinkedInImportButton } from '@/components/features/linkedin';
import { mapLinkedInToResume } from '@/services/linkedin/profileMapper';
import { LinkedInProfile } from '@/types/linkedin';
import { Button, SavePromptModal } from '@/components/ui';
import {
  ArrowLeft,
  Eye,
  Download,
  Sparkles,
  GripVertical,
  ChevronRight,
  User,
  FileText,
  Briefcase,
  GraduationCap,
  Code,
  Folder,
  Award,
  Languages,
  Trophy,
  Plus,
  EyeOff,
  MoreVertical,
  Linkedin,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { SectionType, Resume } from '@/types/resume';

const SECTION_ICONS: Record<SectionType, any> = {
  header: User,
  summary: FileText,
  experience: Briefcase,
  education: GraduationCap,
  skills: Code,
  projects: Folder,
  certifications: Award,
  languages: Languages,
  awards: Trophy,
  custom: Plus,
};

export default function ResumeEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const { shouldShowSavePrompt, hapticEnabled } = useUIStore();
  const {
    resumes,
    createResume,
    setActiveResume,
    getResume,
    updateResumeName,
    toggleSectionVisibility,
    updateHeader,
    updateSummary,
  } = useResumeStore();

  const { profile: linkedInProfile, isLoading: isLinkedInLoading } = useLinkedIn();
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const hasShownPromptRef = useRef(false);
  const editCountRef = useRef(0);

  // AI Hooks
  const { generateSummaryAsync, isLoading: summaryLoading } = useGenerateSummary();
  const { enhanceBulletsAsync, isLoading: bulletsLoading } = useEnhanceBullets();
  const { suggestSkillsAsync, isLoading: skillsLoading } = useSuggestSkills();
  const { scoreResumeAsync, isLoading: scoreLoading } = useScoreResume();

  useEffect(() => {
    if (id === 'new') {
      // Create a new resume
      const newId = createResume('My Resume');
      setResumeId(newId);
      setActiveResume(newId);
    } else if (id) {
      setResumeId(id);
      setActiveResume(id);
    }
  }, [id]);

  // Show save prompt to guest users after some edits
  const triggerSavePromptIfNeeded = useCallback(() => {
    // Only show to guest users
    if (isAuthenticated) return;
    // Only show if not already shown and should show based on cooldown
    if (hasShownPromptRef.current) return;
    if (!shouldShowSavePrompt()) return;

    // Increment edit count and show after 3 edits
    editCountRef.current += 1;
    if (editCountRef.current >= 3) {
      hasShownPromptRef.current = true;
      // Small delay to let the current action complete
      setTimeout(() => {
        setShowSavePrompt(true);
      }, 500);
    }
  }, [isAuthenticated, shouldShowSavePrompt]);

  const resume = resumeId ? getResume(resumeId) : null;

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handlePreview = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/resume/${resumeId}/preview`);
  };

  const handleExport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/resume/${resumeId}/export`);
  };

  const handleEditSection = (sectionType: SectionType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    triggerSavePromptIfNeeded();
    router.push(`/resume/${resumeId}/edit?section=${sectionType}`);
  };

  const handleToggleSection = (sectionId: string) => {
    Haptics.selectionAsync();
    if (resumeId) {
      toggleSectionVisibility(resumeId, sectionId);
    }
  };

  // AI Action Handlers
  const handleGenerateSummary = useCallback(async () => {
    if (!resume) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate to summary edit section to show generated summaries
    router.push(`/resume/${resumeId}/edit?section=summary`);
  }, [resume, resumeId, router]);

  const handleEnhanceAllBullets = useCallback(async () => {
    if (!resume) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate to experience section to enhance bullets
    router.push(`/resume/${resumeId}/edit?section=experience`);
  }, [resume, resumeId, router]);

  const handleSuggestSkills = useCallback(async () => {
    if (!resume) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate to skills section to see suggestions
    router.push(`/resume/${resumeId}/edit?section=skills`);
  }, [resume, resumeId, router]);

  const handleScoreResume = useCallback(async () => {
    if (!resume) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate to preview to get AI score
    router.push(`/resume/${resumeId}/preview`);
  }, [resume, resumeId, router]);

  // LinkedIn Import Handler
  const handleLinkedInSuccess = useCallback(async (profile: LinkedInProfile) => {
    if (!resume || !resumeId) return;

    try {
      setShowMenuModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Map LinkedIn data to resume format and merge with existing data
      const updatedResume = mapLinkedInToResume(profile, resume);

      // Update the resume with merged data
      updateHeader(resumeId, updatedResume.header);
      if (updatedResume.summary) {
        updateSummary(resumeId, updatedResume.summary);
      }

      Alert.alert(
        'Import Successful',
        'Your LinkedIn profile has been imported and merged with your resume.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('[ResumeEditor] LinkedIn import error:', error);
      Alert.alert(
        'Import Error',
        'There was an error importing your LinkedIn profile. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [resume, resumeId, updateHeader, updateSummary]);

  const handleLinkedInError = useCallback((error: string) => {
    setShowMenuModal(false);
    Alert.alert(
      'LinkedIn Import Failed',
      error || 'Unable to import from LinkedIn. Please try again.',
      [{ text: 'OK' }]
    );
  }, []);

  const handleOpenMenu = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowMenuModal(true);
  }, []);

  /**
   * Per-section progress as { filled, total, percent }. Replaces the old
   * binary "100 if any items exist" with real completeness counts so the
   * user sees "3 of 7 fields filled" — actionable feedback instead of an
   * arbitrary 100%.
   */
  const getSectionProgress = (
    sectionType: SectionType,
  ): { filled: number; total: number; percent: number } => {
    const empty = { filled: 0, total: 1, percent: 0 };
    if (!resume) return empty;

    const calc = (filled: number, total: number) => ({
      filled,
      total,
      percent: total === 0 ? 0 : Math.round((filled / total) * 100),
    });

    switch (sectionType) {
      case 'header': {
        const h = resume.header;
        const fields = [
          h.fullName,
          h.jobTitle,
          h.contact.email,
          h.contact.phone,
          h.contact.location,
          h.contact.linkedin,
          h.contact.website,
        ];
        return calc(fields.filter(Boolean).length, fields.length);
      }
      case 'summary':
        // Summary is one field but we weight it by length so a 1-word
        // summary doesn't show 100%. 100+ chars = full credit.
        return resume.summary
          ? calc(Math.min(resume.summary.length, 100), 100)
          : calc(0, 100);
      case 'experience': {
        // Each experience is "complete" when it has title, company, dates,
        // and at least 2 bullets. Show count of complete experiences out
        // of total entries (or "0 of 1" if no entries yet so the user
        // knows there's something to do).
        const total = Math.max(resume.experience.length, 1);
        const complete = resume.experience.filter(
          (e) =>
            e.title &&
            e.company &&
            e.startDate &&
            (e.endDate || e.isCurrentRole) &&
            (e.bullets?.length ?? 0) >= 2,
        ).length;
        return calc(complete, total);
      }
      case 'education': {
        const total = Math.max(resume.education.length, 1);
        const complete = resume.education.filter(
          (e) => e.degree && e.institution && e.startDate && e.endDate,
        ).length;
        return calc(complete, total);
      }
      case 'skills':
        // Recommended: 6+ skills (matches what Resume.io & Zety nudge).
        return calc(Math.min(resume.skills.length, 6), 6);
      case 'projects':
        return calc(resume.projects.length, Math.max(resume.projects.length, 1));
      default:
        return empty;
    }
  };

  if (!resume) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: colors.background }}
      >
        <Text style={{ color: colors.textSecondary }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: colors.border }}>
        <Pressable onPress={handleBack} className="p-2">
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>

        <TextInput
          value={resume.name}
          onChangeText={(text) => updateResumeName(resumeId!, text)}
          className="flex-1 mx-4 text-lg font-semibold text-center"
          style={{ color: colors.text }}
          placeholder="Resume Name"
          placeholderTextColor={colors.textMuted}
        />

        <View className="flex-row gap-2">
          <Pressable onPress={handlePreview} className="p-2">
            <Eye size={22} color={colors.primary} />
          </Pressable>
          <Pressable onPress={handleExport} className="p-2">
            <Download size={22} color={colors.primary} />
          </Pressable>
          <Pressable onPress={handleOpenMenu} className="p-2">
            <MoreVertical size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Next-step guidance — replaces the user's "what do I do first?"
          confusion with a single explicit CTA pointing at the next gap. */}
      <View className="mx-4 mt-4">
        <NextStepCard resume={resume} onContinue={handleEditSection} />
      </View>

      {/* AI Resume Score — secondary, lives below the primary CTA. */}
      <View className="mx-4 mt-3">
        <ResumeScoreInline resume={resume} />
      </View>

      {/* AI Assistant Banner */}
      <Animated.View entering={FadeIn.delay(200)}>
        <Pressable
          onPress={handleGenerateSummary}
          className="mx-4 mt-3 p-4 rounded-xl flex-row items-center"
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
              AI Writing Assistant
            </Text>
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              Get help writing compelling content
            </Text>
          </View>
          <ChevronRight size={20} color={colors.primary} />
        </Pressable>
      </Animated.View>

      {/* Job tools (v1.10) — the outcome features. Tailor analysis is free
          (the hook); applying it and cover letters are the Pro pitch. */}
      <Animated.View entering={FadeIn.delay(250)} className="mx-4 mt-3 flex-row" style={{ gap: 10 }}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/resume/${resumeId}/tailor`);
          }}
          className="flex-1 p-3.5 rounded-xl"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ fontSize: 20, marginBottom: 4 }}>🎯</Text>
          <Text className="font-semibold text-sm" style={{ color: colors.text }}>
            Tailor to a job
          </Text>
          <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
            Match score + rewrite
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/resume/${resumeId}/cover-letter`);
          }}
          className="flex-1 p-3.5 rounded-xl"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ fontSize: 20, marginBottom: 4 }}>✉️</Text>
          <Text className="font-semibold text-sm" style={{ color: colors.text }}>
            Cover letter
          </Text>
          <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
            Written by AI · Pro
          </Text>
        </Pressable>
      </Animated.View>

      {/* Sections List — kept for direct access to any section, but now
          secondary since NextStepCard above tells users where to go next. */}
      <ScrollView className="flex-1 px-4 mt-4" showsVerticalScrollIndicator={false}>
        <Text
          className="text-xs font-medium mb-3 uppercase"
          style={{ color: colors.textMuted, letterSpacing: 1 }}
        >
          Or jump to any section
        </Text>

        {resume.sections
          .sort((a, b) => a.order - b.order)
          .map((section, index) => {
            const Icon = SECTION_ICONS[section.type] || FileText;
            const { filled, total, percent } = getSectionProgress(section.type);
            const isMultiCount = section.type === 'experience' || section.type === 'education' ||
              section.type === 'skills' || section.type === 'projects' || section.type === 'header';

            return (
              <Animated.View
                key={section.id}
                entering={FadeInUp.delay(index * 50)}
              >
                <Pressable
                  onPress={() => handleEditSection(section.type)}
                  className="flex-row items-center p-4 rounded-xl mb-3"
                  style={{
                    backgroundColor: colors.surface,
                    opacity: section.isVisible ? 1 : 0.5,
                  }}
                >
                  <View className="mr-3">
                    <GripVertical size={20} color={colors.textMuted} />
                  </View>

                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                    style={{ backgroundColor: colors.primary + '15' }}
                  >
                    <Icon size={20} color={colors.primary} />
                  </View>

                  <View className="flex-1">
                    <Text
                      className="font-medium"
                      style={{ color: colors.text }}
                    >
                      {section.title}
                    </Text>

                    {/* Progress indicator — bar + "X of Y" label so
                        users see exactly what's missing instead of a
                        meaningless percent. "X of Y" is more actionable. */}
                    <View className="flex-row items-center mt-1">
                      <View
                        className="flex-1 h-1.5 rounded-full mr-2"
                        style={{ backgroundColor: colors.border }}
                      >
                        <View
                          className="h-1.5 rounded-full"
                          style={{
                            backgroundColor:
                              percent === 100 ? colors.success : colors.primary,
                            width: `${percent}%`,
                          }}
                        />
                      </View>
                      <Text
                        className="text-xs"
                        style={{ color: colors.textMuted, fontVariant: ['tabular-nums'] }}
                      >
                        {isMultiCount ? `${filled} / ${total}` : `${percent}%`}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => handleToggleSection(section.id)}
                    className="p-2 ml-2"
                  >
                    {section.isVisible ? (
                      <Eye size={18} color={colors.textMuted} />
                    ) : (
                      <EyeOff size={18} color={colors.textMuted} />
                    )}
                  </Pressable>

                  <ChevronRight size={20} color={colors.textMuted} />
                </Pressable>
              </Animated.View>
            );
          })}

        {/* Add Section Button */}
        <Pressable
          className="flex-row items-center justify-center p-4 rounded-xl mb-8"
          style={{
            backgroundColor: colors.surface,
            borderWidth: 2,
            borderColor: colors.border,
            borderStyle: 'dashed',
          }}
        >
          <Plus size={20} color={colors.textMuted} />
          <Text className="ml-2" style={{ color: colors.textMuted }}>
            Add Custom Section
          </Text>
        </Pressable>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View
        className="px-4 py-4 border-t"
        style={{ borderColor: colors.border, backgroundColor: colors.surface }}
      >
        <Button onPress={handlePreview} fullWidth>
          Preview Resume
        </Button>
      </View>

      {/* AI Floating Action Button */}
      <AIFloatingButton
        onGenerateSummary={handleGenerateSummary}
        onEnhanceAllBullets={handleEnhanceAllBullets}
        onSuggestSkills={handleSuggestSkills}
        onScoreResume={handleScoreResume}
        bottomOffset={100}
        rightOffset={20}
      />

      {/* Menu Modal */}
      <Modal
        visible={showMenuModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenuModal(false)}
      >
        <Pressable
          className="flex-1 justify-end"
          style={{ backgroundColor: colors.overlay }}
          onPress={() => setShowMenuModal(false)}
        >
          <Pressable
            className="rounded-t-3xl px-6 pt-6 pb-10"
            style={{ backgroundColor: colors.surface }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold" style={{ color: colors.text }}>
                Resume Options
              </Text>
              <Pressable
                onPress={() => setShowMenuModal(false)}
                className="p-2 rounded-full"
                style={{ backgroundColor: colors.surfaceSecondary }}
              >
                <X size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* LinkedIn Import Option */}
            <View className="mb-4">
              <Text
                className="text-sm font-medium mb-3 uppercase"
                style={{ color: colors.textMuted }}
              >
                Import Data
              </Text>
              <LinkedInImportButton
                fullWidth
                variant="solid"
                label="Import from LinkedIn"
                onSuccess={handleLinkedInSuccess}
                onError={handleLinkedInError}
                disabled={isLinkedInLoading}
              />
              <Text
                className="text-xs mt-2 text-center"
                style={{ color: colors.textMuted }}
              >
                Import your profile, experience, and skills from LinkedIn
              </Text>
            </View>

            {/* Additional Menu Options */}
            <View className="mt-4 pt-4 border-t" style={{ borderColor: colors.border }}>
              <Pressable
                onPress={() => {
                  setShowMenuModal(false);
                  handlePreview();
                }}
                className="flex-row items-center py-3"
              >
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                  style={{ backgroundColor: colors.primary + '15' }}
                >
                  <Eye size={20} color={colors.primary} />
                </View>
                <Text className="flex-1 text-base" style={{ color: colors.text }}>
                  Preview Resume
                </Text>
                <ChevronRight size={20} color={colors.textMuted} />
              </Pressable>

              <Pressable
                onPress={() => {
                  setShowMenuModal(false);
                  handleExport();
                }}
                className="flex-row items-center py-3"
              >
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                  style={{ backgroundColor: colors.success + '15' }}
                >
                  <Download size={20} color={colors.success} />
                </View>
                <Text className="flex-1 text-base" style={{ color: colors.text }}>
                  Export to PDF
                </Text>
                <ChevronRight size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Save Prompt Modal for Guest Users */}
      <SavePromptModal
        visible={showSavePrompt}
        onClose={() => setShowSavePrompt(false)}
      />
    </SafeAreaView>
  );
}
