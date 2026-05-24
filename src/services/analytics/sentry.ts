/**
 * Sentry init wrapper.
 *
 * Loaded once at app startup. Skips initialization in dev (don't pollute
 * the project's Sentry dashboard with hot-reload churn) and when the DSN
 * env var is not set (so the app still boots cleanly before Sentry is
 * provisioned).
 *
 * DSN: EXPO_PUBLIC_SENTRY_DSN — set as plaintext-visibility env var in EAS
 * Organization: auh-partners
 * Project: android
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const RELEASE = (Constants.expoConfig?.version ?? '0.0.0').toString();

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  if (__DEV__) {
    if (__DEV__) console.log('[sentry] skipped in dev mode');
    return;
  }
  if (!DSN) {
    if (__DEV__) console.log('[sentry] DSN not configured, skipping init');
    return;
  }
  try {
    Sentry.init({
      dsn: DSN,
      release: `freeresume-ai@${RELEASE}`,
      // Capture every crash. Sample non-crash perf at 10 % to stay
      // comfortably inside the free tier (5K events/month).
      tracesSampleRate: 0.1,
      attachStacktrace: true,
      // Redact api_key/token/bearer query params from breadcrumbs so we
      // don't accidentally upload secrets to Sentry's servers.
      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb.category === 'xhr' || breadcrumb.category === 'fetch') {
          if (breadcrumb.data?.url) {
            breadcrumb.data.url = String(breadcrumb.data.url).replace(
              /(api[_-]?key|token|bearer)=[^&]+/gi,
              '$1=REDACTED',
            );
          }
        }
        return breadcrumb;
      },
    });
    initialized = true;
  } catch (err) {
    // Never let Sentry init crash the app
    if (__DEV__) console.log('[sentry] init failed', err);
  }
}

/** Wrap an error so it shows up in Sentry without throwing. */
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    // never let Sentry itself break the app
  }
}

/** Tag the current Sentry session with a user id so crashes are searchable. */
export function setSentryUser(userId: string | null): void {
  if (!initialized) return;
  try {
    Sentry.setUser(userId ? { id: userId } : null);
  } catch {
    // ignore
  }
}
