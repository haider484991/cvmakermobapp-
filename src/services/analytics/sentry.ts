/**
 * Sentry init wrapper.
 *
 * Currently a no-op stub. The @sentry/react-native config plugin requires
 * a Sentry organization + project to be configured at build time and an
 * auth token in EAS env — without those, the Gradle build fails. Adding
 * Sentry will be re-enabled in v1.7.2 after the Sentry account is
 * provisioned. See: https://docs.sentry.io/platforms/react-native/
 *
 * The exported functions stay in the same shape so call sites elsewhere
 * in the codebase don't need to change when we re-enable it.
 */

export function initSentry(): void {
  // No-op. Will be re-enabled in v1.7.2 once Sentry account is set up:
  //   1. Sign up at https://sentry.io
  //   2. Create a React Native project
  //   3. Get DSN + auth token
  //   4. Add @sentry/react-native plugin back to app.json with org/project
  //   5. Set EXPO_PUBLIC_SENTRY_DSN as plaintext EAS env var
}

export function captureError(_err: unknown, _context?: Record<string, unknown>): void {
  // No-op until Sentry is wired back up.
}

export function setSentryUser(_userId: string | null): void {
  // No-op until Sentry is wired back up.
}
