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
import * as Localization from 'expo-localization';
import { supabase } from '@/lib/supabase';

const DEVICE_ID_KEY = '@analytics/device-id-v1';
const QUEUE_KEY = '@analytics/queue-v1';
const APP_VERSION = (Constants.expoConfig?.version ?? '0.0.0').toString();

/**
 * Device geo/locale context, attached to EVERY event's properties.
 *
 * Critical for the paywall debugging: products load for accounts whose
 * Play Store country resolves a price and fail for accounts without an
 * established country. Capturing the device region + currency lets us
 * correlate "products loaded" with country, instead of guessing. Read
 * once per session (doesn't change at runtime).
 */
let cachedDeviceContext: Record<string, unknown> | null = null;
function deviceContext(): Record<string, unknown> {
  if (cachedDeviceContext) return cachedDeviceContext;
  try {
    const loc = Localization.getLocales?.()?.[0];
    cachedDeviceContext = {
      _region: loc?.regionCode ?? null, // ISO country, e.g. "PK", "US"
      _currency: loc?.currencyCode ?? null, // e.g. "PKR", "USD"
      _locale: loc?.languageTag ?? null, // e.g. "en-PK"
    };
  } catch {
    cachedDeviceContext = {};
  }
  return cachedDeviceContext;
}

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
    // Merge device geo-context (region/currency/locale) into every event
    // so we can correlate paywall success with country.
    properties: { ...deviceContext(), ...properties },
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
  // Onboarding funnel — these let us SEE where users drop during onboarding.
  // Before v1.9.7 the only onboarding event was ONBOARDING_COMPLETED, and it
  // never fired (the welcome CTA jumped straight to the dashboard), so the
  // funnel was invisible. step_viewed fires per screen; path_chosen records
  // which build path they picked (ai / import / template); completed fires
  // exactly once when they leave onboarding.
  ONBOARDING_STEP_VIEWED: 'onboarding_step_viewed',
  ONBOARDING_PATH_CHOSEN: 'onboarding_path_chosen',
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

  // AI wizard — the marquee feature, and until v1.14 the only one whose
  // OUTCOME was untracked: handleGenerate fired _STARTED then swallowed the
  // error in a bare catch, so a failed generation and a great one looked
  // identical in the data. These close that hole.
  AI_WIZARD_OPENED: 'ai_wizard_opened',
  AI_WIZARD_GENERATE_STARTED: 'ai_wizard_generate_started',
  AI_WIZARD_GENERATE_SUCCEEDED: 'ai_wizard_generate_succeeded',
  AI_WIZARD_GENERATE_FAILED: 'ai_wizard_generate_failed',
  AI_WIZARD_APPLY: 'ai_wizard_apply',
  /** User tapped Generate while the box still held our own template. */
  AI_WIZARD_BLOCKED_PLACEHOLDER: 'ai_wizard_blocked_placeholder',
  AI_WIZARD_EXAMPLE_USED: 'ai_wizard_example_used',
  /** Guided composer — instrumented from day one so its funnel is visible
   *  immediately, rather than being reconstructed a year later. */
  AI_WIZARD_MODE_SELECTED: 'ai_wizard_mode_selected',
  AI_WIZARD_GUIDED_STEP_VIEWED: 'ai_wizard_guided_step_viewed',
  AI_WIZARD_GUIDED_COMPLETED: 'ai_wizard_guided_completed',
  /** Final step reached but the form isn't submittable — what's missing. */
  AI_WIZARD_GUIDED_BLOCKED: 'ai_wizard_guided_blocked',

  // Live Job Feed (v1.11) — find → tailor → apply loop.
  JOBS_FEED_OPENED: 'jobs_feed_opened',
  JOBS_SEARCHED: 'jobs_searched',
  JOB_VIEWED: 'job_viewed',
  JOB_TAILOR_CLICKED: 'job_tailor_clicked',
  JOB_COVER_LETTER_CLICKED: 'job_cover_letter_clicked',
  JOB_APPLY_CLICKED: 'job_apply_clicked',

  // Post-export job matches (v1.14). The export screen used to end the
  // session — export, ad, nothing. These measure whether turning the app's
  // highest-intent moment into a starting point actually brings people back.
  // Job alerts (v1.14). The permission is asked for HERE, beside real
  // matches — never at launch, because Android 13+ only asks once.
  JOB_ALERTS_PROMPTED: 'job_alerts_prompted',
  JOB_ALERTS_SUBSCRIBED: 'job_alerts_subscribed',
  JOB_ALERTS_DECLINED: 'job_alerts_declined',
  JOB_ALERTS_UPDATED: 'job_alerts_updated',
  JOB_ALERTS_UNSUBSCRIBED: 'job_alerts_unsubscribed',
  JOB_ALERTS_FAILED: 'job_alerts_failed',

  JOB_MATCHES_SHOWN: 'job_matches_shown',
  JOB_MATCHES_FAILED: 'job_matches_failed',
  JOB_MATCH_OPENED: 'job_match_opened',
  JOB_MATCHES_SEE_ALL: 'job_matches_see_all',

  // Application tracker (v1.14) — the first thing in this app that changes
  // while the user is away, and therefore the first real reason to return.
  // STATUS_CHANGED is the retention metric to watch: it can only be fired by
  // someone who came back.
  APPLICATION_LOGGED: 'application_logged',
  APPLICATION_STATUS_CHANGED: 'application_status_changed',
  APPLICATION_OPENED: 'application_opened',
  APPLICATION_REMOVED: 'application_removed',
  APPLICATIONS_VIEWED: 'applications_viewed',

  // Follow-up nudges (v1.14). FOLLOW_UP_SENT is the one that matters: it can
  // only fire for someone who came back to an application days after making
  // it, which is the deepest re-engagement this app has ever measured.
  // Interview prep (v1.14). GENERATED firing at all means someone reached an
  // interview through this app — the outcome the whole loop exists to produce.
  INTERVIEW_PREP_OPENED: 'interview_prep_opened',
  INTERVIEW_PREP_GENERATED: 'interview_prep_generated',
  INTERVIEW_PREP_FAILED: 'interview_prep_failed',
  INTERVIEW_PREP_SHARED: 'interview_prep_shared',

  FOLLOW_UP_OPENED: 'follow_up_opened',
  FOLLOW_UP_DRAFTED: 'follow_up_drafted',
  FOLLOW_UP_FAILED: 'follow_up_failed',
  FOLLOW_UP_SENT: 'follow_up_sent',

  // Job-outcome features (v1.10) — the premium tier's reason to exist.
  TAILOR_OPENED: 'tailor_opened',
  TAILOR_ANALYZED: 'tailor_analyzed',
  TAILOR_APPLIED: 'tailor_applied',
  COVER_LETTER_OPENED: 'cover_letter_opened',
  COVER_LETTER_GENERATED: 'cover_letter_generated',

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
