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
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
    debug: __DEV__,
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
