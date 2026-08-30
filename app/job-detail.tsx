/**
 * Job detail (v1.11) — where a listing turns into an application.
 *
 * Shows the full posting, then the three actions that matter:
 *   • Tailor my resume to this job  → tailor screen, description pre-filled
 *   • Write a cover letter          → cover-letter screen, pre-filled
 *   • Apply on the company site     → opens the posting
 *
 * The job description travels via jobStore (thousands of characters — far too
 * large for a route param).
 */

import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, MapPin, Building2, ExternalLink, Target, Mail, Clock } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useJobStore } from '@/stores/jobStore';
import { useResumeStore } from '@/stores/resumeStore';
import { jobAge } from '@/services/jobs/jobsApi';
import { useTranslation } from 'react-i18next';
import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';
import { useApplicationStore } from '@/stores/applicationStore';
import { gradientColors } from '@/constants/theme';

export default function JobDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { hapticEnabled } = useUIStore();
  const { activeJob: job, setPendingJob } = useJobStore();
  const { getAllResumes, activeResumeId, createResume, setActiveResume } = useResumeStore();
  const { logApplication, hasApplied } = useApplicationStore();
  const [expanded, setExpanded] = useState(false);
  const alreadyApplied = job ? hasApplied(job.id) : false;

  const handleBack = useCallback(() => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router, hapticEnabled]);

  /**
   * Resolve which resume to act on: the active one, else the most recent,
   * else create a fresh one so the user is never dead-ended.
   */
  const resolveResumeId = useCallback((): string => {
    const all = getAllResumes();
    if (activeResumeId && all.some((r) => r.id === activeResumeId)) return activeResumeId;
    if (all.length > 0) {
      setActiveResume(all[0].id);
      return all[0].id;
    }
    const id = createResume(job?.title ? `${job.title} Resume` : 'My Resume');
    setActiveResume(id);
    return id;
  }, [getAllResumes, activeResumeId, createResume, setActiveResume, job]);

  const goWithJob = useCallback(
    (screen: 'tailor' | 'cover-letter') => {
      if (!job) return;
      if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const hadResume = getAllResumes().length > 0;
      const resumeId = resolveResumeId();
      setPendingJob(job); // the target screen consumes this to pre-fill the JD
      track(
        screen === 'tailor'
          ? ANALYTICS_EVENTS.JOB_TAILOR_CLICKED
          : ANALYTICS_EVENTS.JOB_COVER_LETTER_CLICKED,
        { title: job.title.slice(0, 60), had_resume: hadResume },
      );
      if (!hadResume) {
        Alert.alert(
          'Let’s start your resume',
          'You don’t have a resume yet — we’ve created one. Fill in your details, then come back to tailor it to this job.',
          [{ text: 'OK', onPress: () => router.replace(`/resume/${resumeId}`) }],
        );
        return;
      }
      router.push(`/resume/${resumeId}/${screen}`);
    },
    [job, hapticEnabled, resolveResumeId, getAllResumes, setPendingJob, router],
  );

  const handleApply = useCallback(async () => {
    if (!job) return;
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    track(ANALYTICS_EVENTS.JOB_APPLY_CLICKED, { title: job.title.slice(0, 60), company: job.company.slice(0, 40) });

    // Opening the posting is the closest thing to a real "applied" signal we
    // get — the actual form lives on someone else's site. Logging it here is
    // what turns a one-off export into something that accrues, and the store
    // dedupes on job id so tapping Apply twice is harmless. Wrapped because a
    // tracker write must never stop the user reaching the job.
    try {
      const all = getAllResumes();
      const used = all.find((r) => r.id === activeResumeId) ?? all[0];
      const isNew = logApplication({
        job,
        resumeId: used?.id,
        resumeName: used?.name,
      });
      if (isNew) track(ANALYTICS_EVENTS.APPLICATION_LOGGED, { source: 'job_detail', had_resume: Boolean(used) });
    } catch {
      // tracking is best-effort
    }

    try {
      await Linking.openURL(job.url);
    } catch {
      Alert.alert(t('applications.couldNotOpen'), job.url);
    }
  }, [job, hapticEnabled, getAllResumes, activeResumeId, logApplication, t]);

  if (!job) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textSecondary }}>Job not found</Text>
        <Pressable onPress={handleBack} style={{ marginTop: 14 }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const DESC_LIMIT = 1200;
  const isLong = job.description.length > DESC_LIMIT;
  const shownDesc = expanded || !isLong ? job.description : job.description.slice(0, DESC_LIMIT) + '…';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <LinearGradient colors={gradientColors.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 }}>
            <Pressable onPress={handleBack} hitSlop={10} style={{ padding: 4, marginBottom: 8 }}>
              <ArrowLeft size={22} color="white" />
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 14,
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                  overflow: 'hidden',
                }}
              >
                {job.companyLogo ? (
                  <Image source={{ uri: job.companyLogo }} style={{ width: 54, height: 54 }} resizeMode="contain" />
                ) : (
                  <Building2 size={26} color={colors.primary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: 'white', lineHeight: 26 }}>{job.title}</Text>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 3 }}>{job.company}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                <MapPin size={12} color="white" />
                <Text style={{ fontSize: 12, color: 'white', marginLeft: 4, fontWeight: '600' }}>{job.location}</Text>
              </View>
              {job.jobType ? (
                <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ fontSize: 12, color: 'white', fontWeight: '600' }}>{job.jobType}</Text>
                </View>
              ) : null}
              {job.publishedAt ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Clock size={12} color="white" />
                  <Text style={{ fontSize: 12, color: 'white', marginLeft: 4, fontWeight: '600' }}>{jobAge(job.publishedAt)}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Primary action — the whole point of the feature */}
        <Animated.View entering={FadeInUp.duration(300)}>
          <Pressable onPress={() => goWithJob('tailor')} style={{ borderRadius: 16, overflow: 'hidden' }}>
            <LinearGradient
              colors={gradientColors.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 18, flexDirection: 'row', alignItems: 'center' }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
                <Target size={22} color="white" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: 'white', fontSize: 15, fontWeight: '700' }}>Tailor my resume to this job</Text>
                <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 12, marginTop: 2 }}>
                  See your match score + missing keywords — free
                </Text>
              </View>
              <Text style={{ color: 'white', fontSize: 20, fontWeight: '300' }}>›</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* Secondary actions */}
        <Animated.View entering={FadeInUp.delay(80).duration(300)} style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Pressable
            onPress={() => goWithJob('cover-letter')}
            style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, alignItems: 'center' }}
          >
            <Mail size={20} color={colors.primary} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 6 }}>Cover letter</Text>
          </Pressable>
          <Pressable
            onPress={handleApply}
            style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, alignItems: 'center' }}
          >
            <ExternalLink size={20} color={alreadyApplied ? colors.success : colors.primary} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: alreadyApplied ? colors.success : colors.text,
                marginTop: 6,
              }}
            >
              {alreadyApplied ? t('applications.applied') : t('applications.apply')}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Tags */}
        {job.tags.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 20 }}>
            {job.tags.map((tag) => (
              <View key={tag} style={{ backgroundColor: colors.primary + '12', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Description */}
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, marginTop: 24, marginBottom: 10 }}>
          JOB DESCRIPTION
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 22, color: colors.text }}>{shownDesc}</Text>
        {isLong && (
          <Pressable onPress={() => setExpanded((v) => !v)} style={{ marginTop: 12 }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{expanded ? 'Show less' : 'Read full description'}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
