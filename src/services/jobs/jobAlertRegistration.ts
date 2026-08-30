/**
 * Registering (and cancelling) a job-alert subscription.
 *
 * The permission ask lives here rather than at launch on purpose. Android 13+
 * gives you ONE notification prompt: ask on first open and most people decline
 * reflexively, and the permission is gone. Ask straight after showing someone
 * eight roles that match the resume they just finished, and the request has an
 * obvious answer.
 *
 * Everything is best-effort. A failure to subscribe must never surface as an
 * error — the user asked for a convenience, not a transaction.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { requestPermissions, getPushToken } from '@/services/notifications/pushNotifications';
import { buildAlertProfile, profilesDiffer, type JobAlertProfile } from '@/services/jobs/jobAlerts';
import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';
import { captureError } from '@/services/analytics/sentry';
import type { Resume } from '@/types/resume';

/**
 * The Cloudflare Worker that owns the subscription database and the daily
 * cron. Configured per-build; alerts silently stay unavailable if unset, which
 * is the right behaviour for a dev build with no worker deployed.
 */
const WORKER_URL = (process.env.EXPO_PUBLIC_JOB_ALERTS_URL ?? '').replace(/\/$/, '');
const ALERT_KEY = process.env.EXPO_PUBLIC_JOB_ALERTS_KEY ?? '';

/** Is the alert backend configured for this build at all? */
export function alertsAvailable(): boolean {
  return WORKER_URL.length > 0;
}

/** POST to the worker. Throws on anything but a 2xx so callers can log it. */
async function postToWorker(path: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(ALERT_KEY ? { 'X-Alert-Key': ALERT_KEY } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`worker ${path} -> HTTP ${res.status}`);
  }
}

const PROFILE_KEY = '@jobAlerts/profile-v1';
const TOKEN_KEY = '@jobAlerts/token-v1';
const DECLINED_KEY = '@jobAlerts/declined-v1';

/** Has the user turned alerts on for this device? */
export async function isSubscribed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(TOKEN_KEY)) !== null;
  } catch {
    return false;
  }
}

/**
 * Have we already asked and been told no? We ask once. Re-prompting someone
 * who declined is how an app gets uninstalled.
 */
export async function hasDeclined(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DECLINED_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function recordDeclined(): Promise<void> {
  try {
    await AsyncStorage.setItem(DECLINED_KEY, '1');
    track(ANALYTICS_EVENTS.JOB_ALERTS_DECLINED, {});
  } catch {
    // best-effort
  }
}

/**
 * Turn alerts on: ask for permission, get a token, upsert the subscription.
 * Returns false if the user declined or anything failed — the caller should
 * treat that as "not subscribed", never as an error to show.
 */
export async function subscribe(
  resume: Resume | null,
  opts: { industry?: string; locale: string },
): Promise<boolean> {
  const profile = buildAlertProfile(resume, opts);
  if (!profile) return false;
  // Never spend the one notification prompt when there is nothing to register
  // with — on Android 13+ that permission is asked for exactly once.
  if (!alertsAvailable()) return false;

  try {
    const granted = await requestPermissions();
    if (!granted) {
      await recordDeclined();
      return false;
    }

    const token = await getPushToken();
    if (!token) {
      // No token on emulators and on devices without Play Services. Not an
      // error the user needs to see; alerts simply aren't available there.
      track(ANALYTICS_EVENTS.JOB_ALERTS_FAILED, { reason: 'no_token' });
      return false;
    }

    await postToWorker('/subscribe', {
      pushToken: token,
      query: profile.query,
      location: profile.location,
      industry: profile.industry ?? null,
      skills: profile.skills,
      minScore: profile.minScore,
      locale: profile.locale,
      platform: Platform.OS,
      appVersion: (Constants.expoConfig?.version ?? '').toString(),
    });

    await AsyncStorage.setItem(TOKEN_KEY, token);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    track(ANALYTICS_EVENTS.JOB_ALERTS_SUBSCRIBED, {
      query: profile.query,
      skills_count: profile.skills.length,
      had_location: Boolean(profile.location),
      industry: profile.industry ?? null,
    });
    return true;
  } catch (err) {
    captureError(err, { where: 'jobAlerts.subscribe' });
    track(ANALYTICS_EVENTS.JOB_ALERTS_FAILED, { reason: 'exception' });
    return false;
  }
}

/**
 * Keep the saved search current after a resume edit. Does nothing when nothing
 * relevant changed — a write on every edit would be pure noise.
 */
export async function refreshSubscription(
  resume: Resume | null,
  opts: { industry?: string; locale: string },
): Promise<void> {
  try {
    if (!alertsAvailable()) return;
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return; // not subscribed — nothing to refresh

    const next = buildAlertProfile(resume, opts);
    if (!next) return;

    const rawPrev = await AsyncStorage.getItem(PROFILE_KEY);
    const prev: JobAlertProfile | null = rawPrev ? JSON.parse(rawPrev) : null;
    if (!profilesDiffer(prev, next)) return;

    // /subscribe upserts, so the same call updates an existing row.
    await postToWorker('/subscribe', {
      pushToken: token,
      query: next.query,
      location: next.location,
      industry: next.industry ?? null,
      skills: next.skills,
      minScore: next.minScore,
      locale: next.locale,
      platform: Platform.OS,
      appVersion: (Constants.expoConfig?.version ?? '').toString(),
    });

    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    track(ANALYTICS_EVENTS.JOB_ALERTS_UPDATED, { query: next.query });
  } catch (err) {
    captureError(err, { where: 'jobAlerts.refreshSubscription' });
  }
}

/** Turn alerts off. The server DELETES the saved search; re-enabling re-registers. */
export async function unsubscribe(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token && alertsAvailable()) {
      await postToWorker('/unsubscribe', { pushToken: token });
    }
    await AsyncStorage.removeItem(TOKEN_KEY);
    track(ANALYTICS_EVENTS.JOB_ALERTS_UNSUBSCRIBED, {});
  } catch (err) {
    captureError(err, { where: 'jobAlerts.unsubscribe' });
  }
}
