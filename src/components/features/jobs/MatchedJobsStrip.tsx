/**
 * MatchedJobsStrip — turns the export screen from an ending into a beginning.
 *
 * Before this, a successful export was where the session died: save the PDF,
 * show an ad, done. That is the single highest-intent moment in the whole app
 * — the user has just finished a resume, so they are, definitionally, about to
 * apply for something — and we were spending it on a dead end. 73% of users
 * never opened the app again.
 *
 * So the moment now ends with the obvious next step: here are the jobs this
 * resume actually matches, one tap to open, straight into the existing
 * tailor / cover-letter / apply flow.
 *
 * Two deliberate restraints:
 *
 *   - It loads only AFTER a successful export, never on screen mount. The
 *     user's data allowance is not ours to spend speculatively.
 *   - It shows nothing rather than something weak. `rankJobs` already drops
 *     everything under its threshold; if that leaves an empty list we offer
 *     the job tab instead of padding the strip with bad suggestions. A junk
 *     recommendation at this moment costs more trust than a blank space.
 */

import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Bell, Briefcase, Check, ChevronRight, MapPin } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useJobStore } from '@/stores/jobStore';
import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';
import { matchLabel, type JobMatch } from '@/services/jobs/jobMatch';
import { subscribe, isSubscribed, hasDeclined } from '@/services/jobs/jobAlertRegistration';
import { useResumeStore } from '@/stores/resumeStore';
import type { Job } from '@/types/jobs';

interface Props {
  matches: JobMatch[];
  isLoading: boolean;
  hasLoaded: boolean;
  error: boolean;
}

export function MatchedJobsStrip({ matches, isLoading, hasLoaded, error }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { hapticEnabled, onboardingProfile } = useUIStore();
  const { setActiveJob } = useJobStore();
  const { getAllResumes, activeResumeId, getResume } = useResumeStore();
  const router = useRouter();

  /**
   * Four distinct states, because collapsing them shipped a lie: 'hidden'
   * (declined or failed) used to share a state with 'on', so people who said
   * NO were shown "Job alerts are on". Never merge these again.
   */
  const [alertState, setAlertState] = useState<'deciding' | 'offer' | 'on' | 'hidden'>('deciding');
  const [alertsBusy, setAlertsBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      if (await isSubscribed()) return setAlertState('on');
      if (await hasDeclined()) return setAlertState('hidden'); // said no once — never re-ask
      setAlertState('offer');
    })();
  }, []);

  const enableAlerts = async () => {
    if (alertsBusy) return;
    setAlertsBusy(true);
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    track(ANALYTICS_EVENTS.JOB_ALERTS_PROMPTED, { match_count: matches.length });
    const all = getAllResumes();
    const resume = (activeResumeId ? getResume(activeResumeId) : null) ?? all[0] ?? null;
    const ok = await subscribe(resume, {
      industry: onboardingProfile.industry,
      locale: i18n.language || 'en',
    });
    // Success shows the confirmation; failure hides the offer for THIS session
    // only, with no false confirmation and no permanent decline — a network
    // blip must not bury the feature forever. subscribe() itself records the
    // one case that is permanent: the user denying the OS permission.
    setAlertState(ok ? 'on' : 'hidden');
    setAlertsBusy(false);
  };

  const openJob = (match: JobMatch) => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveJob(match.job);
    track(ANALYTICS_EVENTS.JOB_MATCH_OPENED, {
      score: match.score,
      matched_skills: match.matchedSkills.length,
      missing_skills: match.missingSkills.length,
      source: 'export',
    });
    router.push('/job-detail');
  };

  const openFeed = () => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    track(ANALYTICS_EVENTS.JOB_MATCHES_SEE_ALL, { match_count: matches.length });
    router.push('/(main)/jobs');
  };

  // Nothing has been asked for yet — stay out of the way entirely.
  if (!isLoading && !hasLoaded) return null;

  const scoreColor = (score: number) => {
    const band = matchLabel(score);
    if (band === 'strong') return colors.success;
    if (band === 'good') return colors.primary;
    return colors.textSecondary;
  };

  return (
    <Animated.View entering={FadeInUp.duration(320)} style={{ marginTop: 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        <Briefcase size={16} color={colors.primary} />
        <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '700', color: colors.text }}>
          {t('jobMatches.title')}
        </Text>
      </View>
      <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 14 }}>
        {t('jobMatches.subtitle')}
      </Text>

      {isLoading && (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 18 }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ marginLeft: 10, color: colors.textSecondary, fontSize: 14 }}>
            {t('jobMatches.searching')}
          </Text>
        </View>
      )}

      {/* Both the error and the genuinely-empty case land here: we can't help
          right now, so hand them the full feed rather than a bad guess. */}
      {!isLoading && hasLoaded && matches.length === 0 && (
        <Pressable
          onPress={openFeed}
          style={{
            padding: 16,
            borderRadius: 14,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>
            {error ? t('jobMatches.errorBody') : t('jobMatches.emptyBody')}
          </Text>
          <Text style={{ marginTop: 8, color: colors.primary, fontWeight: '700', fontSize: 14 }}>
            {t('jobMatches.browseAll')}
          </Text>
        </Pressable>
      )}

      {!isLoading && matches.length > 0 && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingRight: 4 }}
          >
            {matches.map((m) => (
              <MatchCard
                key={m.job.id}
                match={m}
                colors={colors}
                scoreColor={scoreColor(m.score)}
                matchText={t('jobMatches.percent', { score: String(m.score) })}
                onPress={() => openJob(m)}
              />
            ))}
          </ScrollView>

          {alertState === 'offer' && (
            <Pressable
              onPress={enableAlerts}
              disabled={alertsBusy}
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 14,
                backgroundColor: colors.primary + '10',
                borderWidth: 1,
                borderColor: colors.primary + '30',
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Bell size={18} color={colors.primary} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                  {t('jobAlerts.offerTitle')}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 }}>
                  {t('jobAlerts.offerBody')}
                </Text>
              </View>
              {alertsBusy ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>
                  {t('jobAlerts.turnOn')}
                </Text>
              )}
            </Pressable>
          )}

          {alertState === 'on' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
              <Check size={14} color={colors.success} />
              <Text style={{ marginLeft: 6, fontSize: 12, color: colors.textSecondary }}>
                {t('jobAlerts.onConfirmation')}
              </Text>
            </View>
          )}

          <Pressable
            onPress={openFeed}
            style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, alignSelf: 'flex-start' }}
          >
            <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>
              {t('jobMatches.browseAll')}
            </Text>
            <ChevronRight size={16} color={colors.primary} />
          </Pressable>
        </>
      )}
    </Animated.View>
  );
}

function MatchCard({
  match,
  colors,
  scoreColor,
  matchText,
  onPress,
}: {
  match: JobMatch;
  colors: any;
  scoreColor: string;
  matchText: string;
  onPress: () => void;
}) {
  const job: Job = match.job;
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 240,
        padding: 14,
        borderRadius: 14,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 100,
            backgroundColor: scoreColor + '18',
          }}
        >
          <Text style={{ color: scoreColor, fontSize: 11, fontWeight: '800' }}>{matchText}</Text>
        </View>
      </View>

      <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 20 }}>
        {job.title}
      </Text>
      <Text numberOfLines={1} style={{ fontSize: 13, color: colors.textSecondary, marginTop: 3 }}>
        {job.company}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
        <MapPin size={12} color={colors.textMuted} />
        <Text numberOfLines={1} style={{ marginLeft: 4, fontSize: 12, color: colors.textMuted, flex: 1 }}>
          {job.location}
        </Text>
      </View>

      {/* Say WHY it matched — a bare percentage is an assertion, this is evidence. */}
      {match.matchedSkills.length > 0 && (
        <Text numberOfLines={1} style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary }}>
          {match.matchedSkills.slice(0, 3).join(' · ')}
        </Text>
      )}
    </Pressable>
  );
}

export default MatchedJobsStrip;
