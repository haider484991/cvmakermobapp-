import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn, FadeOut } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useResumeStore } from '@/stores/resumeStore';
import { useUIStore } from '@/stores/uiStore';
import { useGenerateSummary, useEnhanceBullets, useSuggestSkills } from '@/hooks/useAI';
import { useGamification } from '@/hooks/useGamification';
import { buildContextFromResume } from '@/services/ai/resumeAI';
import { AISuggestionCard } from '@/components/features/ai-assistant';
import { Button, Input, Card, SavePromptModal, MonthYearPicker, PhotoPicker } from '@/components/ui';
import { ArrowLeft, Sparkles, Plus, Trash2, Check, Loader2, Eye } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { SectionType, WorkExperience, Education } from '@/types/resume';
import type { SkillSuggestion } from '@/types/ai';
import { validateEmail, validatePhone, validateLinkedIn, validateUrl, validateName, validateGPA } from '@/utils/validation';

export default function EditSection() {
  const { id, section } = useLocalSearchParams<{ id: string; section: SectionType }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { shouldShowSavePrompt, hapticEnabled } = useUIStore();
  const {
    getResume,
    updateHeader,
    updateSummary,
    addExperience,
    updateExperience,
    deleteExperience,
    addEducation,
    updateEducation,
    deleteEducation,
    addSkill,
    deleteSkill,
  } = useResumeStore();

  const resume = getResume(id);

  // Save prompt state for guest users
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const hasShownPromptRef = useRef(false);
  const editCountRef = useRef(0);

  // Show save prompt to guest users after they make edits
  const triggerSavePromptIfNeeded = useCallback(() => {
    if (isAuthenticated) return;
    if (hasShownPromptRef.current) return;
    if (!shouldShowSavePrompt()) return;

    editCountRef.current += 1;
    // Show after 5 field edits on this screen
    if (editCountRef.current >= 5) {
      hasShownPromptRef.current = true;
      setTimeout(() => {
        setShowSavePrompt(true);
      }, 500);
    }
  }, [isAuthenticated, shouldShowSavePrompt]);

  // Wrapped update functions that trigger save prompt
  const wrappedUpdateHeader = useCallback((updates: any) => {
    updateHeader(id, updates);
    triggerSavePromptIfNeeded();
  }, [id, updateHeader, triggerSavePromptIfNeeded]);

  const wrappedUpdateSummary = useCallback((summary: string) => {
    updateSummary(id, summary);
    triggerSavePromptIfNeeded();
  }, [id, updateSummary, triggerSavePromptIfNeeded]);

  const wrappedUpdateExperience = useCallback((expId: string, updates: any) => {
    updateExperience(id, expId, updates);
    triggerSavePromptIfNeeded();
  }, [id, updateExperience, triggerSavePromptIfNeeded]);

  const wrappedUpdateEducation = useCallback((eduId: string, updates: any) => {
    updateEducation(id, eduId, updates);
    triggerSavePromptIfNeeded();
  }, [id, updateEducation, triggerSavePromptIfNeeded]);

  // AI Hooks
  const {
    generateSummaryAsync,
    isLoading: summaryLoading,
    data: summaryData,
    reset: resetSummary,
  } = useGenerateSummary();

  const {
    enhanceBulletsAsync,
    isLoading: bulletsLoading,
    data: bulletsData,
    reset: resetBullets,
  } = useEnhanceBullets();

  const {
    suggestSkillsAsync,
    isLoading: skillsLoading,
    data: skillsData,
    reset: resetSkills,
  } = useSuggestSkills();

  const { trackSectionCompleted } = useGamification();

  // State for AI suggestions
  const [selectedSummaryIndex, setSelectedSummaryIndex] = useState<number | null>(null);
  const [enhancingExperienceId, setEnhancingExperienceId] = useState<string | null>(null);
  const [showSkillSuggestions, setShowSkillSuggestions] = useState(false);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // XP: award section-completion progress on the way out. This call site
    // was missing entirely, so filling in your resume earned nothing and the
    // "sectionsCompleted" achievements could never unlock.
    trackSectionCompleted();
    router.back();
  };

  // AI handlers
  const handleGenerateSummary = useCallback(async () => {
    if (!resume) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const context = buildContextFromResume(resume);
      await generateSummaryAsync(context);
    } catch (error) {
      console.error('Failed to generate summary:', error);
    }
  }, [resume, generateSummaryAsync]);

  const handleApplySummary = useCallback(
    (summaryIndex: number) => {
      if (!summaryData || !resume) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateSummary(id, summaryData.summaries[summaryIndex]);
      resetSummary();
      setSelectedSummaryIndex(null);
    },
    [summaryData, resume, id, updateSummary, resetSummary]
  );

  const handleDismissSummary = useCallback(() => {
    resetSummary();
    setSelectedSummaryIndex(null);
  }, [resetSummary]);

  const handleEnhanceBullets = useCallback(
    async (experience: WorkExperience) => {
      if (!experience.bullets || experience.bullets.length === 0) {
        // If no bullets, use description to create bullets
        if (!experience.description) return;
        const tempExperience = {
          ...experience,
          bullets: [experience.description],
        };
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setEnhancingExperienceId(experience.id);
        try {
          await enhanceBulletsAsync(tempExperience);
        } catch (error) {
          console.error('Failed to enhance bullets:', error);
        }
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setEnhancingExperienceId(experience.id);

      try {
        await enhanceBulletsAsync(experience);
      } catch (error) {
        console.error('Failed to enhance bullets:', error);
      }
    },
    [enhanceBulletsAsync]
  );

  const handleApplyEnhancedBullets = useCallback(
    (experienceId: string, enhancedBullets: string[]) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateExperience(id, experienceId, {
        bullets: enhancedBullets,
        description: enhancedBullets.join('\n'),
      });
      resetBullets();
      setEnhancingExperienceId(null);
    },
    [id, updateExperience, resetBullets]
  );

  const handleDismissEnhancedBullets = useCallback(() => {
    resetBullets();
    setEnhancingExperienceId(null);
  }, [resetBullets]);

  // Industry options offered to the user. Order is by frequency of resume
  // use (mining → least common). Each maps to AI skill suggestion context.
  const INDUSTRIES = [
    'Technology', 'Design', 'Product', 'Marketing', 'Sales', 'Finance',
    'Healthcare', 'Education', 'Engineering', 'Operations', 'Legal',
    'Consulting', 'Media', 'Hospitality', 'Other',
  ];

  /**
   * Infer the user's industry from their job title so the default selection
   * is right most of the time. User can override via the pill picker.
   */
  const inferIndustry = useCallback((jobTitle: string): string => {
    const t = (jobTitle || '').toLowerCase();
    if (/engineer|developer|programmer|swe|devops|architect|coder/.test(t)) return 'Technology';
    if (/designer|ux|ui|graphic|art director|illustrator/.test(t)) return 'Design';
    if (/product manager|\bpm\b|product owner|product lead/.test(t)) return 'Product';
    if (/marketing|growth|brand|seo|content|copywriter/.test(t)) return 'Marketing';
    if (/sales|bdr|sdr|\bae\b|account exec|business development/.test(t)) return 'Sales';
    if (/finance|banker|analyst|accountant|cfo|controller|investment/.test(t)) return 'Finance';
    if (/doctor|nurse|physician|clinical|medical|healthcare|therapist|surgeon/.test(t)) return 'Healthcare';
    if (/teacher|professor|lecturer|instructor|tutor|principal|educator/.test(t)) return 'Education';
    if (/mechanical|civil|electrical|aerospace|chemical/.test(t)) return 'Engineering';
    if (/operations|supply chain|logistics|project manager/.test(t)) return 'Operations';
    if (/lawyer|attorney|paralegal|legal/.test(t)) return 'Legal';
    if (/consultant|strategy|advisor/.test(t)) return 'Consulting';
    if (/journalist|editor|reporter|writer|producer/.test(t)) return 'Media';
    if (/chef|server|hotel|restaurant|hospitality/.test(t)) return 'Hospitality';
    return 'Technology';
  }, []);

  // User-overridable industry. Defaults to inferred from job title.
  const [industry, setIndustry] = useState<string>('Technology');
  // Keep the default in sync when the user changes job title (only if they
  // haven't manually overridden).
  const userOverrodeIndustryRef = useRef(false);
  useEffect(() => {
    if (resume?.header.jobTitle && !userOverrodeIndustryRef.current) {
      setIndustry(inferIndustry(resume.header.jobTitle));
    }
  }, [resume?.header.jobTitle, inferIndustry]);

  const handleSuggestSkills = useCallback(async () => {
    if (!resume) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const jobTitle = resume.header.jobTitle || 'Professional';

    try {
      await suggestSkillsAsync({
        jobTitle,
        industry,
        existingSkills: resume.skills.map((s) => s.name),
      });
      setShowSkillSuggestions(true);
    } catch (error) {
      console.error('Failed to suggest skills:', error);
    }
  }, [resume, industry, suggestSkillsAsync]);

  const handleAddSuggestedSkill = useCallback(
    (skill: SkillSuggestion) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      addSkill(id, {
        id: Date.now().toString(),
        name: skill.name,
        level: skill.relevance === 'high' ? 'advanced' : 'intermediate',
      });
    },
    [id, addSkill]
  );

  const handleDismissSkillSuggestions = useCallback(() => {
    resetSkills();
    setShowSkillSuggestions(false);
  }, [resetSkills]);

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

  const renderHeaderSection = () => (
    <Animated.View entering={FadeInUp.delay(100)}>
      {/* Photo — optional. Shows in sidebar/photo templates; ignored by
          others. Stored as a base64 data URI so it embeds in the PDF. */}
      <PhotoPicker
        value={resume.header.photo}
        onChange={(uri) => wrappedUpdateHeader({ photo: uri ?? undefined })}
      />
      <Input
        label="Full Name"
        value={resume.header.fullName}
        onChangeText={(text) => wrappedUpdateHeader({ fullName: text })}
        placeholder="John Doe"
        containerStyle={{ marginBottom: 16 }}
        validate={validateName}
        validateOnChange
      />
      <Input
        label="Job Title"
        value={resume.header.jobTitle}
        onChangeText={(text) => wrappedUpdateHeader({ jobTitle: text })}
        placeholder="Software Engineer"
        containerStyle={{ marginBottom: 16 }}
      />
      <Input
        label="Email"
        value={resume.header.contact.email}
        onChangeText={(text) =>
          wrappedUpdateHeader({ contact: { ...resume.header.contact, email: text } })
        }
        placeholder="john@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        containerStyle={{ marginBottom: 16 }}
        validate={validateEmail}
        validateOnChange
      />
      <Input
        label="Phone"
        value={resume.header.contact.phone}
        onChangeText={(text) =>
          wrappedUpdateHeader({ contact: { ...resume.header.contact, phone: text } })
        }
        placeholder="+1 (555) 000-0000"
        keyboardType="phone-pad"
        containerStyle={{ marginBottom: 16 }}
        validate={validatePhone}
        validateOnChange
      />
      <Input
        label="Location"
        value={resume.header.contact.location}
        onChangeText={(text) =>
          wrappedUpdateHeader({ contact: { ...resume.header.contact, location: text } })
        }
        placeholder="San Francisco, CA"
        containerStyle={{ marginBottom: 16 }}
      />
      <Input
        label="LinkedIn (optional)"
        value={resume.header.contact.linkedin || ''}
        onChangeText={(text) =>
          wrappedUpdateHeader({ contact: { ...resume.header.contact, linkedin: text } })
        }
        placeholder="linkedin.com/in/johndoe"
        autoCapitalize="none"
        containerStyle={{ marginBottom: 16 }}
        validate={validateLinkedIn}
        validateOnChange
      />
      <Input
        label="Website (optional)"
        value={resume.header.contact.website || ''}
        onChangeText={(text) =>
          wrappedUpdateHeader({ contact: { ...resume.header.contact, website: text } })
        }
        placeholder="johndoe.com"
        autoCapitalize="none"
        validate={validateUrl}
        validateOnChange
      />
    </Animated.View>
  );

  const renderSummarySection = () => (
    <Animated.View entering={FadeInUp.delay(100)}>
      {/* AI Generate Summary Button */}
      <Pressable
        onPress={handleGenerateSummary}
        disabled={summaryLoading}
        className="flex-row items-center justify-center p-3 rounded-xl mb-4"
        style={{
          backgroundColor: colors.primary + '10',
          opacity: summaryLoading ? 0.7 : 1,
        }}
      >
        {summaryLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Sparkles size={18} color={colors.primary} />
        )}
        <Text className="ml-2 font-medium" style={{ color: colors.primary }}>
          {summaryLoading ? 'Generating...' : 'Generate with AI'}
        </Text>
      </Pressable>

      {/* AI Summary Suggestions */}
      {summaryData && summaryData.summaries.length > 0 && (
        <Animated.View entering={FadeIn.duration(300)} className="mb-4">
          <Text
            className="text-sm font-medium mb-3"
            style={{ color: colors.textSecondary }}
          >
            Choose a summary option:
          </Text>
          {summaryData.summaries.map((summary, index) => (
            <View key={index} className="mb-3">
              <AISuggestionCard
                suggestion={summary}
                type="summary"
                title={`Option ${index + 1}`}
                onApply={() => handleApplySummary(index)}
                onDismiss={handleDismissSummary}
                dismissable={index === summaryData.summaries.length - 1}
              />
            </View>
          ))}
        </Animated.View>
      )}

      <Text className="text-sm font-medium mb-2" style={{ color: colors.text }}>
        Professional Summary
      </Text>
      <TextInput
        value={resume.summary}
        onChangeText={(text) => wrappedUpdateSummary(text)}
        placeholder="Write a compelling summary of your professional background, skills, and career objectives..."
        placeholderTextColor={colors.textMuted}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        className="p-4 rounded-xl"
        style={{
          backgroundColor: colors.surface,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
          minHeight: 150,
        }}
      />
      <Text className="text-xs mt-2" style={{ color: colors.textMuted }}>
        Tip: Keep your summary between 2-4 sentences highlighting your key strengths.
      </Text>
    </Animated.View>
  );

  const renderExperienceSection = () => {
    const handleAddExperience = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const newExp: WorkExperience = {
        id: Date.now().toString(),
        company: '',
        title: '',
        location: '',
        startDate: '',
        endDate: null,
        isCurrentRole: false,
        description: '',
        bullets: [],
      };
      addExperience(id, newExp);
    };

    return (
      <Animated.View entering={FadeInUp.delay(100)}>
        {resume.experience.map((exp, index) => {
          const isEnhancing = enhancingExperienceId === exp.id && bulletsLoading;
          const hasEnhancedData =
            enhancingExperienceId === exp.id && bulletsData && !bulletsLoading;

          return (
            <Card key={exp.id} variant="outlined" style={{ marginBottom: 16 }}>
              <View className="flex-row justify-between items-start mb-4">
                <Text className="font-semibold" style={{ color: colors.text }}>
                  Experience {index + 1}
                </Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    deleteExperience(id, exp.id);
                  }}
                >
                  <Trash2 size={18} color={colors.error} />
                </Pressable>
              </View>

              <Input
                label="Job Title"
                value={exp.title}
                onChangeText={(text) => wrappedUpdateExperience(exp.id, { title: text })}
                placeholder="Software Engineer"
                containerStyle={{ marginBottom: 12 }}
              />
              <Input
                label="Company"
                value={exp.company}
                onChangeText={(text) => wrappedUpdateExperience(exp.id, { company: text })}
                placeholder="Tech Company"
                containerStyle={{ marginBottom: 12 }}
              />
              <Input
                label="Location"
                value={exp.location}
                onChangeText={(text) => wrappedUpdateExperience(exp.id, { location: text })}
                placeholder="San Francisco, CA"
                containerStyle={{ marginBottom: 12 }}
              />

              <View className="flex-row gap-3 mb-3">
                <View className="flex-1">
                  <MonthYearPicker
                    label="Start Date"
                    value={exp.startDate}
                    onChange={(v) => wrappedUpdateExperience(exp.id, { startDate: v })}
                    placeholder="Pick a date"
                  />
                </View>
                <View className="flex-1">
                  <MonthYearPicker
                    label="End Date"
                    value={exp.isCurrentRole ? '' : (exp.endDate || '')}
                    onChange={(v) => wrappedUpdateExperience(exp.id, { endDate: v })}
                    placeholder={exp.isCurrentRole ? 'Present' : 'Pick a date'}
                    disabled={exp.isCurrentRole}
                  />
                </View>
              </View>

              {/* "I currently work here" toggle — clears + disables End Date.
                  Tier-1 form UX win: 80% of resumes have a current job so
                  this saves typing "Present" every time. */}
              <Pressable
                onPress={() => {
                  if (hapticEnabled) Haptics.selectionAsync();
                  const next = !exp.isCurrentRole;
                  wrappedUpdateExperience(exp.id, {
                    isCurrentRole: next,
                    endDate: next ? null : exp.endDate,
                  });
                }}
                className="flex-row items-center mb-4 py-2"
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 5,
                    borderWidth: 2,
                    borderColor: exp.isCurrentRole ? colors.primary : colors.border,
                    backgroundColor: exp.isCurrentRole ? colors.primary : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 10,
                  }}
                >
                  {exp.isCurrentRole && <Check size={14} color="white" strokeWidth={3} />}
                </View>
                <Text style={{ color: colors.text, fontSize: 14 }}>I currently work here</Text>
              </Pressable>

              {/* Bullet-by-bullet input — replaces the old wall-of-text
                  textarea. Each achievement gets its own row so:
                    - users think in achievements, not paragraphs
                    - AI enhancement targets the right unit (per-bullet)
                    - templates can render real <ul><li> markup
                  We keep description in sync (newline-joined bullets) so
                  any template still reading exp.description sees the same
                  content; the schema's `bullets: string[]` is now the
                  source of truth and description is derived. */}
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-medium" style={{ color: colors.text }}>
                  Achievements & responsibilities
                </Text>
                <Pressable
                  onPress={() => {
                    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const nextBullets = [...(exp.bullets || []), ''];
                    wrappedUpdateExperience(exp.id, {
                      bullets: nextBullets,
                      description: nextBullets.filter(Boolean).join('\n'),
                    });
                  }}
                  hitSlop={8}
                  className="flex-row items-center"
                >
                  <Plus size={14} color={colors.primary} />
                  <Text className="ml-1 text-xs font-medium" style={{ color: colors.primary }}>
                    Add bullet
                  </Text>
                </Pressable>
              </View>

              {/* If user has legacy description but no bullets yet, seed
                  bullets by splitting on newlines so the upgrade is
                  invisible. Empty arrays show a single blank input so the
                  user always has somewhere to type. */}
              {(() => {
                const bullets =
                  exp.bullets && exp.bullets.length > 0
                    ? exp.bullets
                    : exp.description
                      ? exp.description.split(/\n+/).filter(Boolean)
                      : [''];
                return bullets.map((bullet, bIdx) => (
                  <View
                    key={`b-${bIdx}`}
                    className="flex-row items-start mb-2"
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 16,
                        marginTop: 12,
                        marginRight: 8,
                        lineHeight: 18,
                      }}
                    >
                      •
                    </Text>
                    <TextInput
                      value={bullet}
                      onChangeText={(text) => {
                        const next = [...bullets];
                        next[bIdx] = text;
                        wrappedUpdateExperience(exp.id, {
                          bullets: next,
                          description: next.filter(Boolean).join('\n'),
                        });
                      }}
                      placeholder={bIdx === 0
                        ? 'Led migration of legacy API to GraphQL, reducing latency by 35%'
                        : 'Another achievement...'}
                      placeholderTextColor={colors.textMuted}
                      multiline
                      textAlignVertical="top"
                      className="flex-1 p-3 rounded-xl"
                      style={{
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderWidth: 1,
                        borderColor: colors.border,
                        minHeight: 44,
                        fontSize: 14,
                        lineHeight: 19,
                      }}
                    />
                    {bullets.length > 1 && (
                      <Pressable
                        onPress={() => {
                          if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          const next = bullets.filter((_, i) => i !== bIdx);
                          wrappedUpdateExperience(exp.id, {
                            bullets: next,
                            description: next.filter(Boolean).join('\n'),
                          });
                        }}
                        hitSlop={6}
                        style={{ paddingLeft: 8, paddingTop: 12 }}
                      >
                        <Trash2 size={16} color={colors.textMuted} />
                      </Pressable>
                    )}
                  </View>
                ));
              })()}

              {/* Enhanced Bullets Display */}
              {hasEnhancedData && bulletsData && (
                <Animated.View entering={FadeIn.duration(300)} className="mt-3">
                  <Text
                    className="text-sm font-medium mb-2"
                    style={{ color: colors.success }}
                  >
                    Enhanced bullet points:
                  </Text>
                  {bulletsData.bullets.map((bullet, bulletIndex) => (
                    <View
                      key={bulletIndex}
                      className="p-3 rounded-lg mb-2"
                      style={{ backgroundColor: colors.success + '10' }}
                    >
                      <Text
                        className="text-xs mb-1"
                        style={{ color: colors.textMuted }}
                      >
                        Original: {bullet.originalBullet}
                      </Text>
                      <Text style={{ color: colors.text }}>
                        {bullet.enhancedBullet}
                      </Text>
                    </View>
                  ))}
                  <View className="flex-row justify-end gap-2 mt-2">
                    <Pressable
                      onPress={handleDismissEnhancedBullets}
                      className="px-4 py-2 rounded-lg"
                      style={{ backgroundColor: colors.surfaceSecondary }}
                    >
                      <Text style={{ color: colors.textSecondary }}>Dismiss</Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        handleApplyEnhancedBullets(
                          exp.id,
                          bulletsData.bullets.map((b) => b.enhancedBullet)
                        )
                      }
                      className="px-4 py-2 rounded-lg flex-row items-center"
                      style={{ backgroundColor: colors.success }}
                    >
                      <Check size={16} color="white" />
                      <Text className="ml-1 font-medium" style={{ color: 'white' }}>
                        Apply
                      </Text>
                    </Pressable>
                  </View>
                </Animated.View>
              )}

              {/* AI Enhance Button */}
              <Pressable
                onPress={() => handleEnhanceBullets(exp)}
                disabled={isEnhancing}
                className="flex-row items-center justify-center p-3 rounded-xl mt-3"
                style={{
                  backgroundColor: colors.primary + '10',
                  opacity: isEnhancing ? 0.7 : 1,
                }}
              >
                {isEnhancing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Sparkles size={16} color={colors.primary} />
                )}
                <Text className="ml-2 text-sm font-medium" style={{ color: colors.primary }}>
                  {isEnhancing ? 'Enhancing...' : 'Enhance with AI'}
                </Text>
              </Pressable>
            </Card>
          );
        })}

        <Pressable
          onPress={handleAddExperience}
          className="flex-row items-center justify-center p-4 rounded-xl"
          style={{
            backgroundColor: colors.surface,
            borderWidth: 2,
            borderColor: colors.primary,
            borderStyle: 'dashed',
          }}
        >
          <Plus size={20} color={colors.primary} />
          <Text className="ml-2 font-medium" style={{ color: colors.primary }}>
            Add Experience
          </Text>
        </Pressable>
      </Animated.View>
    );
  };

  const renderEducationSection = () => {
    const handleAddEducation = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const newEdu: Education = {
        id: Date.now().toString(),
        institution: '',
        degree: '',
        field: '',
        location: '',
        startDate: '',
        endDate: '',
        gpa: '',
        achievements: [],
      };
      addEducation(id, newEdu);
    };

    return (
      <Animated.View entering={FadeInUp.delay(100)}>
        {resume.education.map((edu, index) => (
          <Card key={edu.id} variant="outlined" style={{ marginBottom: 16 }}>
            <View className="flex-row justify-between items-start mb-4">
              <Text className="font-semibold" style={{ color: colors.text }}>
                Education {index + 1}
              </Text>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  deleteEducation(id, edu.id);
                }}
              >
                <Trash2 size={18} color={colors.error} />
              </Pressable>
            </View>

            <Input
              label="Institution"
              value={edu.institution}
              onChangeText={(text) => wrappedUpdateEducation(edu.id, { institution: text })}
              placeholder="University of California"
              containerStyle={{ marginBottom: 12 }}
            />
            <Input
              label="Degree"
              value={edu.degree}
              onChangeText={(text) => wrappedUpdateEducation(edu.id, { degree: text })}
              placeholder="Bachelor of Science"
              containerStyle={{ marginBottom: 12 }}
            />
            <Input
              label="Field of Study"
              value={edu.field}
              onChangeText={(text) => wrappedUpdateEducation(edu.id, { field: text })}
              placeholder="Computer Science"
              containerStyle={{ marginBottom: 12 }}
            />
            <Input
              label="Location"
              value={edu.location}
              onChangeText={(text) => wrappedUpdateEducation(edu.id, { location: text })}
              placeholder="Berkeley, CA"
              containerStyle={{ marginBottom: 12 }}
            />

            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <MonthYearPicker
                  label="Start Date"
                  value={edu.startDate}
                  onChange={(v) => wrappedUpdateEducation(edu.id, { startDate: v })}
                  placeholder="Pick a date"
                />
              </View>
              <View className="flex-1">
                <MonthYearPicker
                  label="End Date"
                  value={edu.endDate}
                  onChange={(v) => wrappedUpdateEducation(edu.id, { endDate: v })}
                  placeholder="Pick a date"
                />
              </View>
            </View>

            <Input
              label="GPA (optional)"
              value={edu.gpa || ''}
              onChangeText={(text) => wrappedUpdateEducation(edu.id, { gpa: text })}
              placeholder="3.8"
              keyboardType="decimal-pad"
              validate={validateGPA}
              validateOnChange
            />
          </Card>
        ))}

        <Pressable
          onPress={handleAddEducation}
          className="flex-row items-center justify-center p-4 rounded-xl"
          style={{
            backgroundColor: colors.surface,
            borderWidth: 2,
            borderColor: colors.primary,
            borderStyle: 'dashed',
          }}
        >
          <Plus size={20} color={colors.primary} />
          <Text className="ml-2 font-medium" style={{ color: colors.primary }}>
            Add Education
          </Text>
        </Pressable>
      </Animated.View>
    );
  };

  const renderSkillsSection = () => {
    const [newSkill, setNewSkill] = useState('');

    const handleAddSkill = () => {
      if (newSkill.trim()) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        addSkill(id, {
          id: Date.now().toString(),
          name: newSkill.trim(),
          level: 'intermediate',
        });
        setNewSkill('');
      }
    };

    const getRelevanceColor = (relevance: string) => {
      switch (relevance) {
        case 'high':
          return colors.success;
        case 'medium':
          return colors.warning;
        case 'low':
          return colors.textMuted;
        default:
          return colors.primary;
      }
    };

    return (
      <Animated.View entering={FadeInUp.delay(100)}>
        {/* Industry picker — drives AI skill suggestions. Auto-inferred
            from the job title, user can override with a tap. */}
        <View className="mb-3">
          <Text className="text-xs font-medium mb-2" style={{ color: colors.textSecondary }}>
            Your industry (for AI suggestions)
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 12, gap: 6 }}
          >
            {INDUSTRIES.map((opt) => {
              const active = industry === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => {
                    if (hapticEnabled) Haptics.selectionAsync();
                    userOverrodeIndustryRef.current = true;
                    setIndustry(opt);
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 100,
                    backgroundColor: active ? colors.primary : 'transparent',
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: active ? 'white' : colors.text,
                      fontSize: 12,
                      fontWeight: active ? '700' : '500',
                    }}
                  >
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* AI Suggestion Button */}
        <Pressable
          onPress={handleSuggestSkills}
          disabled={skillsLoading}
          className="flex-row items-center justify-center p-3 rounded-xl mb-4"
          style={{
            backgroundColor: colors.primary + '10',
            opacity: skillsLoading ? 0.7 : 1,
          }}
        >
          {skillsLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Sparkles size={18} color={colors.primary} />
          )}
          <Text className="ml-2 font-medium" style={{ color: colors.primary }}>
            {skillsLoading ? 'Analyzing...' : `Suggest ${industry} Skills`}
          </Text>
        </Pressable>

        {/* AI Skill Suggestions */}
        {showSkillSuggestions && skillsData && skillsData.skills.length > 0 && (
          <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            className="mb-4 p-4 rounded-xl"
            style={{ backgroundColor: colors.primary + '08' }}
          >
            <View className="flex-row justify-between items-center mb-3">
              <Text className="font-semibold" style={{ color: colors.primary }}>
                Suggested Skills
              </Text>
              <Pressable onPress={handleDismissSkillSuggestions}>
                <Text style={{ color: colors.textSecondary }}>Dismiss</Text>
              </Pressable>
            </View>

            <View className="flex-row flex-wrap gap-2">
              {skillsData.skills.map((skill, index) => {
                const isAlreadyAdded = resume.skills.some(
                  (s) => s.name.toLowerCase() === skill.name.toLowerCase()
                );

                return (
                  <Pressable
                    key={index}
                    onPress={() => !isAlreadyAdded && handleAddSuggestedSkill(skill)}
                    disabled={isAlreadyAdded}
                    className="flex-row items-center px-3 py-2 rounded-full"
                    style={{
                      backgroundColor: isAlreadyAdded
                        ? colors.surfaceSecondary
                        : getRelevanceColor(skill.relevance) + '15',
                      borderWidth: 1,
                      borderColor: isAlreadyAdded
                        ? colors.border
                        : getRelevanceColor(skill.relevance) + '30',
                      opacity: isAlreadyAdded ? 0.5 : 1,
                    }}
                  >
                    <Text
                      style={{
                        color: isAlreadyAdded
                          ? colors.textMuted
                          : getRelevanceColor(skill.relevance),
                      }}
                    >
                      {skill.name}
                    </Text>
                    {!isAlreadyAdded && (
                      <Plus
                        size={14}
                        color={getRelevanceColor(skill.relevance)}
                        style={{ marginLeft: 4 }}
                      />
                    )}
                    {isAlreadyAdded && (
                      <Check
                        size={14}
                        color={colors.textMuted}
                        style={{ marginLeft: 4 }}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Text className="text-xs mt-3" style={{ color: colors.textMuted }}>
              Tap a skill to add it to your resume
            </Text>
          </Animated.View>
        )}

        {/* Add Skill Input */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <Input
              value={newSkill}
              onChangeText={setNewSkill}
              placeholder="Type a skill..."
              onSubmitEditing={handleAddSkill}
            />
          </View>
          <Button onPress={handleAddSkill} size="md">
            Add
          </Button>
        </View>

        {/* Skills List */}
        <View className="flex-row flex-wrap gap-2">
          {resume.skills.map((skill) => (
            <View
              key={skill.id}
              className="flex-row items-center px-3 py-2 rounded-full"
              style={{ backgroundColor: colors.primary + '15' }}
            >
              <Text style={{ color: colors.primary }} className="font-medium">
                {skill.name}
              </Text>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  deleteSkill(id, skill.id);
                }}
                className="ml-2"
              >
                <Text style={{ color: colors.primary }}>x</Text>
              </Pressable>
            </View>
          ))}
        </View>

        {resume.skills.length === 0 && (
          <Text className="text-center py-8" style={{ color: colors.textMuted }}>
            No skills added yet. Add skills that are relevant to your target role.
          </Text>
        )}
      </Animated.View>
    );
  };

  const renderSectionContent = () => {
    switch (section) {
      case 'header':
        return renderHeaderSection();
      case 'summary':
        return renderSummarySection();
      case 'experience':
        return renderExperienceSection();
      case 'education':
        return renderEducationSection();
      case 'skills':
        return renderSkillsSection();
      default:
        return (
          <View className="items-center py-8">
            <Text style={{ color: colors.textMuted }}>
              This section is coming soon!
            </Text>
          </View>
        );
    }
  };

  const getSectionTitle = () => {
    // Section title is now i18n-driven via the editor.sections.<key> bundle.
    // If the section param doesn't match a known key (rare), fall back to
    // a generic translated label.
    if (section && t(`editor.sections.${section}`) !== `editor.sections.${section}`) {
      return t(`editor.sections.${section}`);
    }
    return t('common.edit');
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header — polished to match Stitch design: back arrow + brand wordmark
            on left, Preview pill on right. The step indicator + section title
            move into a "hero" block right under the header. */}
        <View
          className="flex-row items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: colors.border, backgroundColor: colors.background }}
        >
          <View className="flex-row items-center flex-1">
            <Pressable onPress={handleBack} className="p-2 mr-1" hitSlop={8}>
              <ArrowLeft size={22} color={colors.text} />
            </Pressable>
            <Text
              className="font-semibold"
              style={{ color: colors.text, fontSize: 15, letterSpacing: 0.2 }}
            >
              FreeResume AI
            </Text>
          </View>
          <Pressable
            onPress={() => router.push(`/resume/${id}/preview`)}
            className="flex-row items-center px-3 py-1.5 rounded-full"
            style={{ backgroundColor: colors.primary + '15' }}
            hitSlop={6}
          >
            <Eye size={14} color={colors.primary} />
            <Text
              className="ml-1.5 font-semibold"
              style={{ color: colors.primary, fontSize: 13 }}
            >
              {t('common.preview')}
            </Text>
          </Pressable>
        </View>

        {/* Step indicator + section title hero — gives users clear context
            ("STEP 2 OF 5") so the flow stops feeling lost. Step is computed
            from the resume.sections order. Total is the count of visible
            sections only, so hidden/optional ones don't inflate it. */}
        {(() => {
          const visibleSections = (resume?.sections || [])
            .filter((s) => s.isVisible)
            .sort((a, b) => a.order - b.order);
          const idx = visibleSections.findIndex((s) => s.type === section);
          const step = idx >= 0 ? idx + 1 : 1;
          const total = Math.max(visibleSections.length, 1);
          return (
            <View className="px-5 pt-5 pb-3">
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 1.4,
                }}
              >
                {t('editor.stepOf', { current: step, total })}
              </Text>
              <Text
                className="font-bold mt-1"
                style={{ color: colors.text, fontSize: 28, letterSpacing: -0.5 }}
              >
                {getSectionTitle()}
              </Text>
              {/* Thin progress bar */}
              <View
                className="h-1 rounded-full mt-4 overflow-hidden"
                style={{ backgroundColor: colors.border }}
              >
                <View
                  style={{
                    backgroundColor: colors.primary,
                    height: '100%',
                    width: `${(step / total) * 100}%`,
                    borderRadius: 999,
                  }}
                />
              </View>
            </View>
          );
        })()}

        {/* Content — wrapped in a polished surface card so individual inputs
            feel grouped and "premium" rather than floating on the page. */}
        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // Drag down on the form to dismiss the keyboard — the simplest
          // "Done" affordance that works across iOS + Android without
          // having to plumb refs through every TextInput.
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          contentContainerStyle={{ paddingBottom: 110, paddingTop: 4 }}
        >
          <View
            className="rounded-2xl p-4"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {renderSectionContent()}
          </View>
          <View className="h-8" />
        </ScrollView>

        {/* Sticky bottom action bar — primary "Done" CTA with a checkmark
            affordance so the user gets a clear "save and back" signal. */}
        <View
          className="px-4 pt-3 pb-4 border-t"
          style={{ borderColor: colors.border, backgroundColor: colors.background }}
        >
          <Pressable
            onPress={handleBack}
            className="flex-row items-center justify-center py-3.5 rounded-2xl"
            style={{
              backgroundColor: colors.primary,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 10,
              elevation: 5,
            }}
          >
            <Check size={18} color="white" strokeWidth={2.5} />
            <Text
              className="ml-2 font-bold"
              style={{ color: 'white', fontSize: 16, letterSpacing: 0.2 }}
            >
              {t('common.saveAndContinue')}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Save Prompt Modal for Guest Users */}
      <SavePromptModal
        visible={showSavePrompt}
        onClose={() => setShowSavePrompt(false)}
      />
    </SafeAreaView>
  );
}
