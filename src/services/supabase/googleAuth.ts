/**
 * Google Sign-In via Supabase OAuth (browser-based PKCE flow).
 *
 * Flow:
 *   1. Ask Supabase for the Google authorize URL (skipBrowserRedirect — we
 *      open it ourselves).
 *   2. Open it in an auth session (Chrome Custom Tab on Android,
 *      ASWebAuthenticationSession on iOS). The user picks their Google account.
 *   3. Google → Supabase → `halflifecontrol://auth-callback?code=...`, which
 *      closes the browser and hands the URL back to us.
 *   4. Exchange the one-time code for a session on-device (PKCE verifier lives
 *      in SecureStore). The root AuthGate routes on the resulting auth event.
 *
 * Why the browser flow instead of the native Google Sign-In SDK: it needs only
 * a single "Web application" OAuth client in Google Cloud (no per-platform
 * client IDs or SHA-1 fingerprints), and the same code works unchanged on iOS.
 *
 * Setup (one-time, see docs/DEVELOPERINPUT.md item 15): Google provider
 * enabled in Supabase with the Web client ID/secret, and `halflifecontrol://**`
 * in Supabase's Redirect URLs allow-list.
 */
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './config';
import {
  AUTH_REDIRECT_PATHS,
  authRedirectUrl,
  completeAuthFromUrl,
  getUserProfile,
} from './auth';
import type { UserProfile } from '@/core/types';

/** Thrown when the user closes the Google sheet without finishing. */
class GoogleSignInCancelledError extends Error {
  constructor() {
    super('Google sign-in was cancelled');
    this.name = 'GoogleSignInCancelledError';
  }
}

export async function signInWithGoogle(): Promise<UserProfile> {
  const redirectTo = authRedirectUrl(AUTH_REDIRECT_PATHS.oauthCallback);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      // Always show the account chooser — otherwise a device with one Google
      // account signs straight in, which is confusing on a shared phone.
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Supabase did not return a Google sign-in URL');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    // 'cancel' / 'dismiss'. On some Android versions the session reports
    // 'dismiss' even when the redirect did arrive — in that case the
    // /auth-callback route completes the exchange and the AuthGate navigates,
    // so staying silent here is correct either way.
    throw new GoogleSignInCancelledError();
  }

  const user = await completeAuthFromUrl(result.url);
  return getUserProfile(user.userId, { email: user.email, displayName: user.displayName });
}

export function isGoogleCancellation(error: unknown): boolean {
  return error instanceof GoogleSignInCancelledError;
}
