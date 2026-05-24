/**
 * Sentry init wrapper.
 *
 * Loaded once at app startup. Skips initialization in dev (don't pollute
 * the project's Sentry dashboard with reloads) and when the DSN env var
 * is not set (so the app still boots cleanly before Sentry is provisioned).
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
  Sentry.init({
    dsn: DSN,
    release: `freeresume-ai@${RELEASE}`,
    // Capture every crash; sample non-crash perf at 10 % to keep the free
    // tier quota healthy.
    tracesSampleRate: 0.1,
    // Don't capture the entire JS state — keep crash reports lightweight.
    attachStacktrace: true,
    // Filter out network noise — many of our requests have keys in URLs
    // that we don't want to upload to Sentry's servers.
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
