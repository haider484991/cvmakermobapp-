/**
 * No-op stand-in for src/services/analytics/sentry.ts used by the AI smoke
 * harness (tsconfig.smoke.json maps the import here). @sentry/react-native
 * can't load under plain node; error reports go to the console instead.
 */

export function initSentry(): void {}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  console.log('[sentry-stub] captureError:', err, context ?? '');
}

export function setSentryUser(): void {}
