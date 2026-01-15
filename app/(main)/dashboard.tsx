import { View, Text, Pressable, ScrollView, RefreshControl, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUIStore } from '@/stores/uiStore';
import { useSync } from '@/hooks/useSync';
import { SyncStatusIndicator } from '@/components/ui/SyncStatusIndicator';
import { Plus, FileText, MoreVertical, Trash2, Copy, Edit3, Sparkles } from 'lucide-react-native';
import { gradientColors } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { useState, useCallback, useMemo } from 'react';
import type { Resume } from '@/types/resume';

export default function Dashboard() {
  const router = useRouter();
  const { colors } = useTheme();
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

  const [refreshing, setRefreshing] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

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
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const id = createResume();
    setActiveResume(id);
    router.push(`/resume/${id}`);
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
                  My Resumes
                </Text>
                <Text className="text-white/70 text-sm">
                  {resumes.length === 0
                    ? 'Create your first resume'
                    : `${resumes.length} resume${resumes.length !== 1 ? 's' : ''}`}
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
        {/* Create New Card */}
        <Animated.View entering={FadeInUp.delay(100)} style={{ marginTop: 24 }}>
          <LinearGradient
            colors={gradientColors.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 20, padding: 1 }}
          >
            <Pressable
              onPress={handleCreateResume}
              className="rounded-[19px] p-5 flex-row items-center"
              style={{ backgroundColor: colors.background }}
            >
              <LinearGradient
                colors={gradientColors.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16,
                }}
              >
                <Plus size={26} color="white" strokeWidth={2.5} />
              </LinearGradient>
              <View className="flex-1">
                <Text
                  className="text-lg font-bold"
                  style={{ color: colors.text }}
                >
                  Create New Resume
                </Text>
                <View className="flex-row items-center mt-1">
                  <Sparkles size={14} color={colors.primary} />
                  <Text style={{ color: colors.textSecondary, marginLeft: 4 }}>
                    Start with AI assistance
                  </Text>
                </View>
              </View>
            </Pressable>
          </LinearGradient>
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
    </View>
  );
}
