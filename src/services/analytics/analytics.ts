/**
 * Product analytics — logs typed events to a Supabase table.
 *
 * Goals:
 *   - Cheap to call (fire-and-forget, never blocks UI)
 *   - Resilient to network failures (queues, retries on next launch)
 *   - Anonymous-first (generates a device_id on first launch)
 *   - Zero dependencies on Firebase / Mixpanel / PostHog — leverages the
 *     Supabase instance we already pay for
 *
 * Usage:
 *   import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';
 *   track(ANALYTICS_EVENTS.RESUME_EXPORTED, { template_id: 'modern-pro', paper_size: 'a4' });
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const DEVICE_ID_KEY = '@analytics/device-id-v1';
const QUEUE_KEY = '@analytics/queue-v1';
const APP_VERSION = (Constants.expoConfig?.version ?? '0.0.0').toString();

interface PendingEvent {
  event_name: string;
  properties: Record<string, unknown>;
  occurred_at: string; // ISO
}

let cachedDeviceId: string | null = null;
let cachedUserId: string | null = null;
let flushing = false;

function devLog(...args: unknown[]) {
  if (__DEV__) console.log('[analytics]', ...args);
}

function randomId(): string {
  // Lightweight UUID-ish (sufficient for anonymous device IDs — not RFC4122)
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      cachedDeviceId = existing;
      return existing;
    }
    const fresh = randomId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, fresh);
    cachedDeviceId = fresh;
    return fresh;
  } catch {
    return randomId(); // ephemeral fallback, still better than nothing
  }
}

/** Optionally tag subsequent events with the signed-in user id. */
export function setAnalyticsUser(userId: string | null): void {
  cachedUserId = userId;
}

async function flushQueue(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: PendingEvent[] = raw ? JSON.parse(raw) : [];
    if (queue.length === 0) return;

    const deviceId = await getDeviceId();
    const rows = queue.map((e) => ({
      device_id: deviceId,
      user_id: cachedUserId,
      event_name: e.event_name,
      properties: e.properties,
      app_version: APP_VERSION,
      platform: Platform.OS,
      occurred_at: e.occurred_at,
    }));

    // Cast: the Supabase generated types haven't been regenerated since
    // migration 002 added this table. Safe at runtime — the migration
    // creates the table with these columns. Regenerate types via
    // `supabase gen types typescript` to drop this cast.
    const { error } = await (supabase.from as any)('analytics_events').insert(rows);
    if (error) {
      devLog('flush failed, leaving queue for next attempt', error.message);
      return;
    }
    devLog(`flushed ${rows.length} events`);
    await AsyncStorage.removeItem(QUEUE_KEY);
  } catch (err) {
    devLog('flush exception', err);
  } finally {
    flushing = false;
  }
}

async function enqueue(event: PendingEvent): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: PendingEvent[] = raw ? JSON.parse(raw) : [];
    queue.push(event);
    // Cap the queue so a long offline session doesn't bloat storage.
    const trimmed = queue.slice(-500);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    devLog('enqueue failed', err);
  }
}

/**
 * Fire an event. Never throws, never blocks. If offline, buffers to
 * AsyncStorage and flushes on the next successful network call.
 */
export function track(event_name: string, properties: Record<string, unknown> = {}): void {
  // Skip in dev unless explicitly enabled — keeps the dev DB clean.
  if (__DEV__ && !process.env.EXPO_PUBLIC_ANALYTICS_DEV) {
    devLog(`(dev skip) ${event_name}`, properties);
    return;
  }

  const event: PendingEvent = {
    event_name,
    properties,
    occurred_at: new Date().toISOString(),
  };

  // Best-effort: enqueue, then attempt flush. If either fails, the next
  // call will pick up where we left off.
  enqueue(event)
    .then(() => flushQueue())
    .catch((err) => devLog('track failed', err));
}

/** Manually trigger a flush — call on app foreground or auth state change. */
export function flushAnalytics(): Promise<void> {
  return flushQueue();
}

/**
 * Canonical event-name strings. Centralized so names don't drift across the
 * codebase and so renames stay grep-able in one place.
 */
export const ANALYTICS_EVENTS = {
  // Lifecycle
  APP_OPENED: 'app_opened',
  APP_FOREGROUNDED: 'app_foregrounded',
  ONBOARDING_COMPLETED: 'onboarding_completed',

  // Resume management
  RESUME_CREATED: 'resume_created',
  RESUME_DELETED: 'resume_deleted',
  RESUME_DUPLICATED: 'resume_duplicated',
  RESUME_EDITED: 'resume_edited',

  // Import
  RESUME_IMPORT_STARTED: 'resume_import_started',
  RESUME_IMPORT_SUCCEEDED: 'resume_import_succeeded',
  RESUME_IMPORT_FAILED: 'resume_import_failed',

  // Export
  RESUME_EXPORT_STARTED: 'resume_export_started',
  RESUME_EXPORT_SUCCEEDED: 'resume_export_succeeded',
  RESUME_EXPORT_FAILED: 'resume_export_failed',
  RESUME_SHARED: 'resume_shared',
  RESUME_PREVIEWED: 'resume_previewed',

  // Templates
  TEMPLATE_SELECTED: 'template_selected',
  TEMPLATE_PICKER_OPENED: 'template_picker_opened',

  // AI
  AI_SCORE_REQUESTED: 'ai_score_requested',
  AI_SCORE_COMPLETED: 'ai_score_completed',
  AI_SCORE_FAILED: 'ai_score_failed',
  AI_SUMMARY_GENERATED: 'ai_summary_generated',
  AI_BULLETS_ENHANCED: 'ai_bullets_enhanced',
  AI_SKILLS_SUGGESTED: 'ai_skills_suggested',

  // Monetization (used by v1.8)
  PAYWALL_SHOWN: 'paywall_shown',
  PAYWALL_DISMISSED: 'paywall_dismissed',
  PURCHASE_INITIATED: 'purchase_initiated',
  PURCHASE_COMPLETED: 'purchase_completed',
  PURCHASE_FAILED: 'purchase_failed',
  PURCHASE_RESTORED: 'purchase_restored',

  // Ads
  AD_IMPRESSION: 'ad_impression',
  AD_CLICKED: 'ad_clicked',
  AD_REWARDED_EARNED: 'ad_rewarded_earned',

  // Review prompt
  REVIEW_PROMPT_SHOWN: 'review_prompt_shown',
  REVIEW_PROMPT_ACCEPTED: 'review_prompt_accepted',
  REVIEW_PROMPT_DECLINED: 'review_prompt_declined',
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
