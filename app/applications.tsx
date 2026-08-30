/**
 * Application tracker.
 *
 * The one screen in this app whose contents change while the user is away —
 * which is the entire reason it exists. A resume is finished and then it is
 * finished forever; a list of live applications ages, and ageing is a reason
 * to come back.
 *
 * The list is ordered by what needs doing, not by when it happened: anything
 * gone quiet past a week sits at the top, then offers, then live interviews,
 * then everything still waiting, then the closed ones. See
 * services/applications/applicationInsights.ts — the ordering and the
 * follow-up judgement are pure and tested there rather than inline here.
 */

import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Briefcase, Clock, ExternalLink, Send, Sparkles, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useApplicationStore } from '@/stores/applicationStore';
import { ScreenHeader } from '@/components/ui';
import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';
import {
  scheduleFollowUpReminder,
  cancelFollowUpReminder,
} from '@/services/notifications/pushNotifications';
import {
  sortForDisplay,
  summarize,
  needsFollowUp,
  daysSince,
  type Application,
  type ApplicationStatus,
} from '@/services/applications/applicationInsights';

const STATUSES: ApplicationStatus[] = ['applied', 'interviewing', 'offer', 'rejected'];

export default function Applications() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { hapticEnabled } = useUIStore();
  const { applications, setStatus, removeApplication } = useApplicationStore();

  // One clock for the whole render, so every "9 days ago" on screen agrees.
  const [now] = useState(() => Date.now());

  const list = useMemo(
    () => sortForDisplay(Object.values(applications), now),
    [applications, now],
  );
  const stats = useMemo(() => summarize(list, now), [list, now]);

  // One daily reminder, reflecting the current count — never one per
  // application. Cancelled outright when there is nothing left to chase, so
  // the app goes quiet the moment the user is caught up.
  useEffect(() => {
    if (stats.needsFollowUp > 0) {
      void scheduleFollowUpReminder(
        stats.needsFollowUp,
        t('followUp.notificationTitle'),
        t('followUp.notificationBody', { count: String(stats.needsFollowUp) }),
      );
    } else {
      void cancelFollowUpReminder();
    }
  }, [stats.needsFollowUp, t]);

  const statusColor = (status: ApplicationStatus): string =>
    status === 'offer'
      ? colors.success
      : status === 'interviewing'
        ? colors.primary
        : status === 'rejected'
          ? colors.textMuted
          : colors.warning;

  const changeStatus = (app: Application, status: ApplicationStatus) => {
    if (hapticEnabled) Haptics.selectionAsync();
    setStatus(app.id, status);
    track(ANALYTICS_EVENTS.APPLICATION_STATUS_CHANGED, {
      from: app.status,
      to: status,
      days_since_applied: daysSince(app.appliedAt, now),
    });
  };

  const openPosting = (app: Application) => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    track(ANALYTICS_EVENTS.APPLICATION_OPENED, { status: app.status });
    Linking.openURL(app.url).catch(() => Alert.alert(t('applications.couldNotOpen'), app.url));
  };

  const confirmRemove = (app: Application) => {
    Alert.alert(t('applications.removeTitle'), t('applications.removeBody', { title: app.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          removeApplication(app.id);
          track(ANALYTICS_EVENTS.APPLICATION_REMOVED, { status: app.status });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t('applications.title')} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {list.length === 0 ? (
          <View style={{ paddingTop: 40, alignItems: 'center' }}>
            <Briefcase size={40} color={colors.textMuted} />
            <Text
              style={{
                marginTop: 16,
                fontSize: 16,
                fontWeight: '700',
                color: colors.text,
                textAlign: 'center',
              }}
            >
              {t('applications.emptyTitle')}
            </Text>
            <Text
              style={{
                marginTop: 8,
                fontSize: 14,
                color: colors.textSecondary,
                textAlign: 'center',
                lineHeight: 20,
              }}
            >
              {t('applications.emptyBody')}
            </Text>
            <Pressable
              onPress={() => router.push('/(main)/jobs')}
              style={{
                marginTop: 20,
                paddingVertical: 12,
                paddingHorizontal: 22,
                borderRadius: 12,
                backgroundColor: colors.primary,
              }}
            >
              <Text style={{ color: 'white', fontWeight: '700' }}>{t('applications.findJobs')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Summary — the "am I still trying?" line */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
              <Stat value={stats.open} label={t('applications.statOpen')} colors={colors} />
              <Stat
                value={stats.needsFollowUp}
                label={t('applications.statFollowUp')}
                colors={colors}
                highlight={stats.needsFollowUp > 0 ? colors.warning : undefined}
              />
              <Stat value={stats.thisWeek} label={t('applications.statThisWeek')} colors={colors} />
            </View>

            {list.map((app, i) => {
              const chase = needsFollowUp(app, now);
              const days = daysSince(app.appliedAt, now);
              return (
                <Animated.View
                  key={app.id}
                  entering={FadeInUp.delay(Math.min(i, 8) * 40).duration(260)}
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: chase ? colors.warning + '55' : colors.border,
                    marginBottom: 12,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                        {app.title}
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                        {app.company}
                      </Text>
                    </View>
                    <Pressable onPress={() => confirmRemove(app)} hitSlop={10}>
                      <Trash2 size={16} color={colors.textMuted} />
                    </Pressable>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                    <Clock size={12} color={chase ? colors.warning : colors.textMuted} />
                    <Text
                      style={{
                        marginLeft: 5,
                        fontSize: 12,
                        color: chase ? colors.warning : colors.textMuted,
                        fontWeight: chase ? '700' : '400',
                      }}
                    >
                      {chase
                        ? t('applications.chaseIt', { days: String(days) })
                        : t('applications.appliedDaysAgo', { days: String(days) })}
                    </Text>
                  </View>

                  {/* Status is the thing the user comes back to change. */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                    {STATUSES.map((s) => {
                      const on = app.status === s;
                      return (
                        <Pressable
                          key={s}
                          onPress={() => changeStatus(app, s)}
                          style={{
                            paddingVertical: 6,
                            paddingHorizontal: 12,
                            borderRadius: 100,
                            backgroundColor: on ? statusColor(s) : 'transparent',
                            borderWidth: 1,
                            borderColor: on ? statusColor(s) : colors.border,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: on ? '700' : '500',
                              color: on ? 'white' : colors.textSecondary,
                            }}
                          >
                            {t(`applications.status.${s}`)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {app.status === 'interviewing' && (
                    <Pressable
                      onPress={() => {
                        if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        track(ANALYTICS_EVENTS.INTERVIEW_PREP_OPENED, {
                          cached: Boolean(app.interviewPrep),
                        });
                        router.push({ pathname: '/interview-prep', params: { id: app.id } });
                      }}
                      style={{
                        marginTop: 12,
                        paddingVertical: 11,
                        borderRadius: 12,
                        backgroundColor: colors.primary,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Sparkles size={15} color="white" />
                      <Text style={{ marginLeft: 7, color: 'white', fontWeight: '700', fontSize: 14 }}>
                        {t('applications.prepareForInterview')}
                      </Text>
                    </Pressable>
                  )}

                  {chase && (
                    <Pressable
                      onPress={() => {
                        if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        track(ANALYTICS_EVENTS.FOLLOW_UP_OPENED, {
                          days_since_applied: days,
                        });
                        router.push({ pathname: '/follow-up', params: { id: app.id } });
                      }}
                      style={{
                        marginTop: 12,
                        paddingVertical: 11,
                        borderRadius: 12,
                        backgroundColor: colors.primary,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Send size={15} color="white" />
                      <Text style={{ marginLeft: 7, color: 'white', fontWeight: '700', fontSize: 14 }}>
                        {t('applications.writeFollowUp')}
                      </Text>
                    </Pressable>
                  )}

                  <Pressable
                    onPress={() => openPosting(app)}
                    style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}
                  >
                    <ExternalLink size={14} color={colors.primary} />
                    <Text style={{ marginLeft: 6, color: colors.primary, fontWeight: '600', fontSize: 13 }}>
                      {t('applications.viewPosting')}
                    </Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  value,
  label,
  colors,
  highlight,
}: {
  value: number;
  label: string;
  colors: any;
  highlight?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: 12,
        borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: highlight ?? colors.border,
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: '800', color: highlight ?? colors.text }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{label}</Text>
    </View>
  );
}
