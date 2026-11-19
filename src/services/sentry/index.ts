/**
 * Sentry crash reporting service.
 * Gracefully degrades when DSN is not configured (development).
 */
import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

let initialized = false;

export function initSentry(): void {
  if (initialized || !DSN) {
    if (!DSN) {
      console.warn('[Sentry] EXPO_PUBLIC_SENTRY_DSN not set — crash reporting disabled');
    }
    return;
  }

  Sentry.init({
    dsn: DSN,
    // Lets the Sentry dashboard filter emulator/dev noise from real builds.
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
    // SDK debug logging floods Metro; flip on only when debugging Sentry itself.
    debug: false,
  });

  initialized = true;
}

export function setSentryUser(uid: string, email?: string | null): void {
  if (!initialized) return;
  Sentry.setUser({ id: uid, email: email ?? undefined });
}

export function clearSentryUser(): void {
  if (!initialized) return;
  Sentry.setUser(null);
}

export function captureException(error: unknown): void {
  if (!initialized) {
    if (__DEV__) console.error('[Sentry.captureException]', error);
    return;
  }
  Sentry.captureException(error);
}

/** True once Sentry.init ran (a DSN is configured). */
export function isSentryEnabled(): boolean {
  return initialized;
}

/**
 * Send a clearly-labelled test error and flush it right away, so the
 * developer can confirm events reach the dashboard. Resolves to false when
 * Sentry isn't configured.
 */
export async function sendTestError(): Promise<boolean> {
  if (!initialized) return false;
  Sentry.captureException(new Error(`Sentry test error (sent ${new Date().toISOString()})`));
  return Sentry.flush();
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  if (!initialized) return;
  Sentry.captureMessage(message, level);
}

export function addBreadcrumb(
  category: string,
  message: string,
  level: Sentry.SeverityLevel = 'info',
): void {
  if (!initialized) return;
  Sentry.addBreadcrumb({ category, message, level });
}

/** Sentry.wrap() for the root component — only wraps when initialized. */
export const wrapRootComponent = DSN ? Sentry.wrap : (component: React.ComponentType) => component;
