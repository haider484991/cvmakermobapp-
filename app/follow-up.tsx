/**
 * Follow-up composer.
 *
 * Reached from an application that has gone quiet. Drafts a short email the
 * user can edit and send — the point is to remove the blank page, not to send
 * anything on their behalf. Nothing is sent from the app: the draft opens in
 * the user's own mail client, addressed by them, so the message comes from a
 * real person's inbox and any reply lands there too.
 *
 * The draft is editable before sending on purpose. A follow-up written by
 * someone else and fired off unread is exactly how people end up sending
 * something that does not sound like them.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Linking,
  Alert,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { Copy, Mail, RefreshCw, Share2, X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useApplicationStore } from '@/stores/applicationStore';
import { ScreenHeader } from '@/components/ui';
import { generateFollowUpEmail } from '@/services/ai/resumeAI';
import { captureError } from '@/services/analytics/sentry';
import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';
import { daysSince } from '@/services/applications/applicationInsights';

export default function FollowUp() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { hapticEnabled } = useUIStore();
  const { applications } = useApplicationStore();
  const { getResume, getAllResumes, activeResumeId } = useResumeStore();

  const app = id ? applications[id] : undefined;

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draft = useCallback(async () => {
    if (!app) return;
    setIsLoading(true);
    setError(null);
    const startedAt = Date.now();
    try {
      const all = getAllResumes();
      const resume =
        (app.resumeId ? getResume(app.resumeId) : null) ??
        (activeResumeId ? getResume(activeResumeId) : null) ??
        all[0] ??
        null;

      const result = await generateFollowUpEmail(
        {
          jobTitle: app.title,
          company: app.company,
          daysSinceApplied: daysSince(app.appliedAt, Date.now()),
        },
        resume,
      );
      setSubject(result.subject);
      setBody(result.body);
      track(ANALYTICS_EVENTS.FOLLOW_UP_DRAFTED, {
        days_since_applied: daysSince(app.appliedAt, Date.now()),
        had_resume: Boolean(resume),
        duration_ms: Date.now() - startedAt,
        model: result.model,
      });
    } catch (err: any) {
      const code = err?.code ?? 'UNKNOWN';
      setError(err?.message || t('followUp.error'));
      captureError(new Error(`Follow-up draft failed: ${code}`), { code });
      track(ANALYTICS_EVENTS.FOLLOW_UP_FAILED, { code });
    } finally {
      setIsLoading(false);
    }
  }, [app, getAllResumes, getResume, activeResumeId, t]);

  // Draft once on open — the user came here to get a draft, not to press a
  // button that gets them one.
  useEffect(() => {
    if (app && !body && !isLoading && !error) void draft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.id]);

  const openMail = useCallback(async () => {
    if (!app) return;
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    track(ANALYTICS_EVENTS.FOLLOW_UP_SENT, { via: 'mail' });
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      await Linking.openURL(url);
    } catch {
      // No mail client configured is common enough on Android that a dead end
      // here would be a real failure — fall back to the share sheet.
      try {
        await Share.share({ message: `${subject}\n\n${body}` });
      } catch {
        Alert.alert(t('followUp.noMailApp'));
      }
    }
  }, [app, subject, body, hapticEnabled, t]);

  const copy = useCallback(async () => {
    if (hapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Clipboard.setStringAsync(`${subject}\n\n${body}`);
    track(ANALYTICS_EVENTS.FOLLOW_UP_SENT, { via: 'copy' });
    Alert.alert(t('followUp.copied'));
  }, [subject, body, hapticEnabled, t]);

  const share = useCallback(async () => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    track(ANALYTICS_EVENTS.FOLLOW_UP_SENT, { via: 'share' });
    try {
      await Share.share({ message: `${subject}\n\n${body}` });
    } catch {
      // user cancelled
    }
  }, [subject, body, hapticEnabled]);

  if (!app) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={t('followUp.title')} onBack={() => router.back()} />
        <View style={{ padding: 24 }}>
          <Text style={{ color: colors.textSecondary }}>{t('followUp.missing')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const ready = body.trim().length > 0 && !isLoading;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t('followUp.title')} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{app.title}</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2, marginBottom: 18 }}>
          {app.company} · {t('applications.appliedDaysAgo', { days: String(daysSince(app.appliedAt, Date.now())) })}
        </Text>

        {isLoading && (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ marginLeft: 10, color: colors.textSecondary }}>{t('followUp.writing')}</Text>
          </View>
        )}

        {error && !isLoading && (
          <View
            style={{
              padding: 12,
              borderRadius: 10,
              backgroundColor: colors.error + '12',
              borderWidth: 1,
              borderColor: colors.error + '40',
              flexDirection: 'row',
              alignItems: 'flex-start',
              marginBottom: 16,
            }}
          >
            <X size={16} color={colors.error} />
            <Text style={{ marginLeft: 8, flex: 1, color: colors.error, fontSize: 13, lineHeight: 18 }}>
              {error}
            </Text>
          </View>
        )}

        {!isLoading && (body || error) && (
          <Animated.View entering={FadeIn.duration(200)}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
              {t('followUp.subject')}
            </Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder={t('followUp.subjectPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: colors.text,
                fontSize: 15,
                marginBottom: 16,
              }}
            />

            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
              {t('followUp.message')}
            </Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              multiline
              textAlignVertical="top"
              placeholder={t('followUp.messagePlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: 14,
                minHeight: 200,
                color: colors.text,
                fontSize: 15,
                lineHeight: 22,
              }}
            />

            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 10, lineHeight: 17 }}>
              {t('followUp.editHint')}
            </Text>

            <Pressable
              onPress={draft}
              style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, alignSelf: 'flex-start' }}
            >
              <RefreshCw size={15} color={colors.primary} />
              <Text style={{ marginLeft: 6, color: colors.primary, fontWeight: '600', fontSize: 14 }}>
                {t('followUp.rewrite')}
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      {ready && (
        <View
          style={{
            padding: 16,
            paddingBottom: 24,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <Pressable
              onPress={copy}
              style={{
                flex: 1,
                paddingVertical: 13,
                borderRadius: 12,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Copy size={16} color={colors.text} />
              <Text style={{ marginLeft: 6, color: colors.text, fontWeight: '600' }}>{t('followUp.copy')}</Text>
            </Pressable>
            <Pressable
              onPress={share}
              style={{
                flex: 1,
                paddingVertical: 13,
                borderRadius: 12,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Share2 size={16} color={colors.text} />
              <Text style={{ marginLeft: 6, color: colors.text, fontWeight: '600' }}>{t('followUp.share')}</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={openMail}
            style={{
              paddingVertical: 15,
              borderRadius: 14,
              backgroundColor: colors.primary,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Mail size={18} color="white" />
            <Text style={{ marginLeft: 8, color: 'white', fontWeight: '700', fontSize: 15 }}>
              {t('followUp.openMail')}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
