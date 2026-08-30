import { View, Text, Pressable, ScrollView, RefreshControl, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUIStore } from '@/stores/uiStore';
import { useSync } from '@/hooks/useSync';
import { useResumeImport } from '@/hooks/useResumeImport';
import { useGamification } from '@/hooks/useGamification';
import { SyncStatusIndicator } from '@/components/ui/SyncStatusIndicator';
import { PremiumImportHero, ImportReviewModal } from '@/components/features/import';
import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';
import {
  XPProgressBar,
  StreakCounter,
  DailyBonusCard,
  LevelBadge,
  AchievementUnlockModal,
} from '@/components/gamification';
import { Plus, FileText, MoreVertical, Trash2, Copy, Edit3, Sparkles, Briefcase, ClipboardList } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useApplicationStore } from '@/stores/applicationStore';
import { summarize } from '@/services/applications/applicationInsights';
import { gradientColors } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { useState, useCallback, useMemo, useEffect } from 'react';
import type { Resume } from '@/types/resume';

export default function Dashboard() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const applications = useApplicationStore((s) => s.applications);
  const applicationList = useMemo(() => Object.values(applications), [applications]);
  const applicationCount = applicationList.length;
  const applicationStats = useMemo(
    () => summarize(applicationList, Date.now()),
    [applicationList],
  );
  const { hapticEnabled } = useUIStore();
  const {
    getAllResumes,
    createResume,
    deleteResume,
    duplicateResume,
    setActiveResume,
  } = useResumeStore();
  const { getTemplate, selectedTemplateId } = useTemplateStore();
  const { isSyncing, refresh } = useSync();
  const { selectAndParse, isReviewing, isLoading: isImporting, error: importError, reset: resetImport } = useResumeImport();
  const {
    showAchievementModal,
    currentUnlock,
    dismissAchievement,
    trackResumeCreated,
    dailyBonusClaimed,
  } = useGamification();

  const [refreshing, setRefreshing] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const resumes = useMemo(() => getAllResumes(), [getAllResumes]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await refresh();
    setRefreshing(false);
  }, [hapticEnabled, refresh]);

  const handleCreateResume = () => {
    // Prevent duplicate creation on fast taps
    if (isCreating) return;

    setIsCreating(true);
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const id = createResume();
      setActiveResume(id);
      // Track for gamification
      trackResumeCreated();
      // Track for product analytics
      track(ANALYTICS_EVENTS.RESUME_CREATED, { source: 'dashboard_button' });
      router.push(`/resume/${id}`);
    } finally {
      // Reset after a short delay to allow navigation
      setTimeout(() => setIsCreating(false), 1000);
    }
  };

  const handleOpenResume = (id: string) => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setActiveResume(id);
    router.push(`/resume/${id}`);
  };

  const handleDeleteResume = (id: string) => {
    if (hapticEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    deleteResume(id);
    setMenuOpenId(null);
  };

  const handleDuplicateResume = (id: string) => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const newId = duplicateResume(id);
    setMenuOpenId(null);
    if (newId) {
      router.push(`/resume/${newId}`);
    }
  };

  const toggleMenu = (id: string) => {
    if (hapticEnabled) {
      Haptics.selectionAsync();
    }
    setMenuOpenId(menuOpenId === id ? null : id);
  };

  const handleImportPress = useCallback(async () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await selectAndParse();
  }, [hapticEnabled, selectAndParse]);

  const handleImportConfirm = useCallback((resumeId: string) => {
    setShowImportModal(false);
    router.push(`/resume/${resumeId}`);
  }, [router]);

  const handleImportCancel = useCallback(() => {
    setShowImportModal(false);
  }, []);

  // Show import modal when reviewing
  useEffect(() => {
    if (isReviewing) {
      setShowImportModal(true);
    }
  }, [isReviewing]);

  // Surface import/parse failures — previously these were silent, so a
  // failed AI extraction looked like "nothing happened after upload".
  useEffect(() => {
    if (importError) {
      Alert.alert(
        "Couldn't read that file",
        `${importError}\n\nTry a different file, or use "Build with AI" to type your details instead.`,
        [{ text: 'OK', onPress: () => resetImport() }],
      );
    }
  }, [importError, resetImport]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getResumeProgress = (resume: Resume): number => {
    let filled = 0;
    let total = 5;

    if (resume.header.fullName) filled++;
    if (resume.summary) filled++;
    if (resume.experience.length > 0) filled++;
    if (resume.education.length > 0) filled++;
    if (resume.skills.length > 0) filled++;

    return Math.round((filled / total) * 100);
  };

  const getTemplateName = (templateId: string): string => {
    const template = getTemplate(templateId);
    return template?.name || 'Default';
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Gradient Header */}
      <LinearGradient
        colors={gradientColors.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
      >
        <SafeAreaView edges={['top']}>
          <View className="px-6 pt-4 pb-2 flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <Image
                source={require('../../assets/icon.png')}
                style={{ width: 40, height: 40, marginRight: 12 }}
                resizeMode="contain"
              />
              <View>
                <Text className="text-2xl font-bold text-white">
                  {t('dashboard.title')}
                </Text>
                <Text className="text-white/70 text-sm">
                  {resumes.length === 0
                    ? t('dashboard.empty')
                    : t('dashboard.subtitle', { count: resumes.length })}
                </Text>
              </View>
            </View>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 4 }}>
              <SyncStatusIndicator size="md" />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        className="flex-1 px-6"
        style={{ marginTop: -12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isSyncing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Gamification — only once the user has at least one resume. For a
            brand-new user, an empty XP bar + streak + daily bonus is noise
            that pushes the actual "create a resume" actions below the fold.
            Show it after they've made something to celebrate. */}
        {resumes.length > 0 && (
          <Animated.View entering={FadeInUp.delay(50)} style={{ marginTop: 24 }}>
            {/* XP Progress with Level and Streak */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <XPProgressBar compact />
              </View>
              <StreakCounter compact />
            </View>

            {/* Daily Bonus - only show if not claimed */}
            {!dailyBonusClaimed && (
              <View style={{ marginBottom: 12 }}>
                <DailyBonusCard />
              </View>
            )}
          </Animated.View>
        )}

        {/* Premium Import Hero — primary CTA. Importing an existing resume
            converts faster than starting from scratch, so it owns the most
            valuable real estate on this screen. */}
        <Animated.View entering={FadeInUp.delay(100)} style={{ marginTop: resumes.length > 0 ? 12 : 24 }}>
          <PremiumImportHero
            onPress={handleImportPress}
            disabled={isImporting}
          />
        </Animated.View>

        {/* AI Wizard — the magic moment. User types/speaks one paragraph,
            AI structures into a full resume. Sits between PDF import (best
            if you have one) and Start-from-Scratch (worst case). */}
        <Animated.View entering={FadeInUp.delay(125)} style={{ marginTop: 12 }}>
          <Pressable
            onPress={() => {
              if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              track('ai_wizard_opened' as any, { source: 'dashboard' });
              router.push('/resume/ai-wizard');
            }}
            className="rounded-2xl overflow-hidden"
          >
            <LinearGradient
              colors={gradientColors.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 18, flexDirection: 'row', alignItems: 'center' }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: 'rgba(255,255,255,0.22)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 14,
                }}
              >
                <Sparkles size={24} color="white" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: 'white', fontSize: 15, fontWeight: '700' }}>
                  Build with AI
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 12, marginTop: 2 }}>
                  Describe yourself in a paragraph — AI builds the resume
                </Text>
              </View>
              <Text style={{ color: 'white', fontSize: 20, fontWeight: '300' }}>›</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* Find Jobs (v1.11) — the app is now where the job search STARTS,
            not just where the resume gets made. */}
        <Animated.View entering={FadeInUp.delay(140)} style={{ marginTop: 12 }}>
          <Pressable
            onPress={() => {
              if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(main)/jobs');
            }}
            className="rounded-2xl p-5 flex-row items-center"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          >
            <View
              className="items-center justify-center mr-4"
              style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primary + '15' }}
            >
              <Briefcase size={24} color={colors.primary} strokeWidth={2.5} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold" style={{ color: colors.text }}>
                Find Jobs
              </Text>
              <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                Browse remote roles — tailor your resume in one tap
              </Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 20, fontWeight: '300' }}>›</Text>
          </Pressable>
        </Animated.View>

        {/* Application tracker — only once it holds something. The list is
            the one thing in this app that changes while the user is away, so
            the follow-up count is what makes coming back worthwhile. */}
        {applicationCount > 0 && (
          <Animated.View entering={FadeInUp.delay(145)} style={{ marginTop: 12 }}>
            <Pressable
              onPress={() => {
                if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                track(ANALYTICS_EVENTS.APPLICATIONS_VIEWED, {
                  total: applicationCount,
                  needs_follow_up: applicationStats.needsFollowUp,
                });
                router.push('/applications');
              }}
              className="rounded-2xl p-5 flex-row items-center"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: applicationStats.needsFollowUp > 0 ? colors.warning + '55' : colors.border,
              }}
            >
              <View
                className="items-center justify-center mr-4"
                style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primary + '15' }}
              >
                <ClipboardList size={24} color={colors.primary} strokeWidth={2.5} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold" style={{ color: colors.text }}>
                  {t('applications.title')}
                </Text>
                <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                  {applicationStats.needsFollowUp > 0
                    ? t('applications.dashboardNudge', {
                        count: String(applicationStats.needsFollowUp),
                      })
                    : t('applications.dashboardOpen', { count: String(applicationStats.open) })}
                </Text>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 20, fontWeight: '300' }}>›</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Create New Card — secondary path for users without a resume yet. */}
        <Animated.View entering={FadeInUp.delay(150)} style={{ marginTop: 12 }}>
          <Pressable
            onPress={handleCreateResume}
            disabled={isCreating}
            className="rounded-2xl p-5 flex-row items-center"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: isCreating ? 0.7 : 1,
            }}
          >
            <View
              className="items-center justify-center mr-4"
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: colors.primary + '15',
              }}
            >
              <Plus size={24} color={colors.primary} strokeWidth={2.5} />
            </View>
            <View className="flex-1">
              <Text
                className="text-base font-semibold"
                style={{ color: colors.text }}
              >
                {isCreating ? 'Creating…' : 'Start from Scratch'}
              </Text>
              <View className="flex-row items-center mt-1">
                <Sparkles size={12} color={colors.textSecondary} />
                <Text className="text-xs" style={{ color: colors.textSecondary, marginLeft: 4 }}>
                  Build a new resume with AI assistance
                </Text>
              </View>
            </View>
          </Pressable>
        </Animated.View>

        {/* Resume Cards */}
        {resumes.length > 0 ? (
          resumes.map((resume, index) => {
            const progress = getResumeProgress(resume);
            const isMenuOpen = menuOpenId === resume.id;

            return (
              <Animated.View
                key={resume.id}
                entering={FadeInUp.delay(200 + index * 100)}
              >
                <Pressable
                  onPress={() => handleOpenResume(resume.id)}
                  className="rounded-2xl p-5 mb-4"
                  style={{ backgroundColor: colors.surface }}
                >
                  <View className="flex-row items-start">
                    <View
                      className="w-12 h-12 rounded-xl items-center justify-center mr-4"
                      style={{ backgroundColor: colors.primary + '15' }}
                    >
                      <FileText size={24} color={colors.primary} />
                    </View>
                    <View className="flex-1">
                      <Text
                        className="text-lg font-semibold mb-1"
                        style={{ color: colors.text }}
                        numberOfLines={1}
                      >
                        {resume.name}
                      </Text>
                      <Text
                        className="text-sm mb-2"
                        style={{ color: colors.textSecondary }}
                      >
                        {getTemplateName(resume.templateId)} • {formatDate(resume.updatedAt)}
                      </Text>

                      {/* Progress Bar */}
                      <View className="flex-row items-center">
                        <View
                          className="flex-1 h-2 rounded-full mr-3"
                          style={{ backgroundColor: colors.border }}
                        >
                          <View
                            className="h-2 rounded-full"
                            style={{
                              backgroundColor:
                                progress >= 80
                                  ? colors.success
                                  : progress >= 50
                                    ? colors.warning
                                    : colors.error,
                              width: `${progress}%`,
                            }}
                          />
                        </View>
                        <Text
                          className="text-sm"
                          style={{ color: colors.textSecondary }}
                        >
                          {progress}%
                        </Text>
                      </View>
                    </View>

                    {/* Menu Button */}
                    <Pressable
                      onPress={() => toggleMenu(resume.id)}
                      className="p-2"
                      hitSlop={8}
                    >
                      <MoreVertical size={20} color={colors.textSecondary} />
                    </Pressable>
                  </View>

                  {/* Dropdown Menu */}
                  {isMenuOpen && (
                    <Animated.View
                      entering={FadeIn.duration(150)}
                      className="mt-3 pt-3"
                      style={{ borderTopWidth: 1, borderTopColor: colors.border }}
                    >
                      <View className="flex-row gap-3">
                        <Pressable
                          onPress={() => handleOpenResume(resume.id)}
                          className="flex-1 flex-row items-center justify-center py-2 rounded-lg"
                          style={{ backgroundColor: colors.primary + '10' }}
                        >
                          <Edit3 size={16} color={colors.primary} />
                          <Text
                            className="ml-2 font-medium"
                            style={{ color: colors.primary }}
                          >
                            Edit
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleDuplicateResume(resume.id)}
                          className="flex-1 flex-row items-center justify-center py-2 rounded-lg"
                          style={{ backgroundColor: colors.textSecondary + '10' }}
                        >
                          <Copy size={16} color={colors.textSecondary} />
                          <Text
                            className="ml-2 font-medium"
                            style={{ color: colors.textSecondary }}
                          >
                            Duplicate
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeleteResume(resume.id)}
                          className="flex-1 flex-row items-center justify-center py-2 rounded-lg"
                          style={{ backgroundColor: colors.error + '10' }}
                        >
                          <Trash2 size={16} color={colors.error} />
                          <Text
                            className="ml-2 font-medium"
                            style={{ color: colors.error }}
                          >
                            Delete
                          </Text>
                        </Pressable>
                      </View>
                    </Animated.View>
                  )}
                </Pressable>
              </Animated.View>
            );
          })
        ) : (
          <Animated.View
            entering={FadeInUp.delay(200)}
            className="items-center py-12"
          >
            <Text className="text-6xl mb-4">📄</Text>
            <Text
              className="text-lg font-medium text-center mb-2"
              style={{ color: colors.text }}
            >
              No resumes yet
            </Text>
            <Text
              className="text-center"
              style={{ color: colors.textSecondary }}
            >
              Create your first resume to get started
            </Text>
          </Animated.View>
        )}

        {/* Bottom Spacing */}
        <View className="h-8" />
      </ScrollView>

      {/* Import Review Modal */}
      <ImportReviewModal
        visible={showImportModal}
        onClose={handleImportCancel}
        onConfirm={handleImportConfirm}
      />

      {/* Achievement Unlock Modal */}
      <AchievementUnlockModal
        achievement={currentUnlock}
        visible={showAchievementModal}
        onClose={dismissAchievement}
      />
    </View>
  );
}
