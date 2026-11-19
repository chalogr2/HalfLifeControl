import * as Linking from 'expo-linking';
import { supabase } from './config';
import { clearUserCache } from '@/services/cache';
import type { UserProfile, UserSettings } from '@/core/types';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export async function signUp(email: string, password: string): Promise<UserProfile> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  // Preserve the original AuthError so callers can read `.code` / `.status`.
  // Wrapping in `new Error(error.message)` was stripping those fields and
  // forcing every login/register failure into the catchall branch.
  if (error) throw error;
  if (!data.user) throw new Error('Sign-up succeeded but no user returned');

  // The handle_new_user trigger creates the profile row automatically.
  // Wait briefly for the trigger to complete, then fetch the profile.
  // On a fresh signup the session is available immediately (email confirmation is off in dev).
  return getUserProfile(data.user.id, {
    email: data.user.email ?? '',
    displayName:
      (data.user.user_metadata?.display_name as string | undefined) ?? null,
  });
}

export async function signIn(email: string, password: string): Promise<UserProfile> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  if (!data.user) throw new Error('Sign-in succeeded but no user returned');

  return getUserProfile(data.user.id, {
    email: data.user.email ?? '',
    displayName:
      (data.user.user_metadata?.display_name as string | undefined) ?? null,
  });
}

export async function signOut(): Promise<void> {
  // Route through getSession() so the userNotAvailableProxy path (rare:
  // encrypted user blob unreadable) doesn't throw before we capture the
  // UID for cache cleanup. Best-effort — if the proxy recovery itself
  // fails we skip the per-user cache clear and let the next sign-in
  // re-establish state.
  const session = await getSession();
  const uid = session?.userId;

  // Cancel all scheduled notifications before signing out
  const { cancelAllReminders } = await import('@/services/notifications');
  await cancelAllReminders().catch(() => {});

  await supabase.auth.signOut();

  if (uid) await clearUserCache(uid).catch(() => {});
}

/**
 * Permanently delete the signed-in user's account and all their data.
 *
 * The `delete-account` Edge Function verifies the session JWT and deletes the
 * auth user server-side (cascading to profile, pills and doses). Only after it
 * succeeds do we tear down the device: reminders, the local encrypted cache
 * (including any unsent write-ahead-log entries) and the session. Local
 * sign-out only — the server session no longer exists to revoke.
 */
export async function deleteAccount(): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error('You need to be signed in to delete your account.');

  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) {
    throw new Error('Could not delete your account. Check your connection and try again.');
  }

  const { cancelAllReminders } = await import('@/services/notifications');
  await cancelAllReminders().catch(() => {});
  await clearUserCache(session.userId).catch(() => {});
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}

// ─── Deep-link auth (password recovery + OAuth) ──────

/**
 * In-app routes that Supabase redirects back to. Each must be listed under
 * Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
 * (`halflifecontrol://**` covers both), or Supabase falls back to the Site URL
 * and the link opens a browser page instead of the app.
 */
export const AUTH_REDIRECT_PATHS = {
  resetPassword: 'reset-password',
  oauthCallback: 'auth-callback',
} as const;

/** `halflifecontrol://<path>` in dev/prod builds (scheme from app.json). */
export function authRedirectUrl(path: string): string {
  return Linking.createURL(path);
}

export async function resetPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authRedirectUrl(AUTH_REDIRECT_PATHS.resetPassword),
  });
  if (error) throw error;
}

/** Set a new password for the signed-in user (used after a recovery link). */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Read a param from either the query string or the #fragment of a redirect URL. */
function redirectParam(url: string, name: string): string | null {
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.split('?')[1] ?? '';
  return new URLSearchParams(query).get(name) ?? new URLSearchParams(hash).get(name);
}

// A PKCE code is single-use. Both the OAuth browser session and the
// deep-link route screen may see the same redirect URL (Android delivers it
// to the router *and* to openAuthSessionAsync), so concurrent callers share
// one in-flight exchange instead of the loser failing with "code already used".
const exchanges = new Map<string, Promise<{ userId: string; email: string; displayName: string | null }>>();

/**
 * Finish a Supabase redirect (`...?code=` on success, `...?error_description=`
 * on failure) by exchanging the one-time code for a session. Resolves with the
 * signed-in user; `onAuthStateChange` also fires, so the root AuthGate picks
 * the session up on its own.
 */
export function completeAuthFromUrl(
  url: string,
): Promise<{ userId: string; email: string; displayName: string | null }> {
  const errorDescription = redirectParam(url, 'error_description');
  if (errorDescription) {
    return Promise.reject(new Error(errorDescription.replace(/\+/g, ' ')));
  }

  const code = redirectParam(url, 'code');
  if (!code) return Promise.reject(new Error('The sign-in link is missing its code.'));

  const existing = exchanges.get(code);
  if (existing) return existing;

  const exchange = (async () => {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    const meta = data.user.user_metadata ?? {};
    return {
      userId: data.user.id,
      email: data.user.email ?? '',
      // Google puts the name in full_name/name; email sign-ups use display_name.
      displayName: (meta.display_name ?? meta.full_name ?? meta.name ?? null) as string | null,
    };
  })();
  exchanges.set(code, exchange);
  return exchange;
}

interface ProfileFallback {
  email: string;
  displayName?: string | null;
}

/**
 * Fetch the user's profile row. If it's missing (predates the
 * handle_new_user trigger, or was manually deleted) and a `fallback` is
 * supplied, recreate it. Without a fallback, missing rows surface as an
 * error.
 *
 * Pass the fallback from the caller's auth-user data (signIn / signUp /
 * cold-start session). We don't call supabase.auth.getUser() here because
 * it makes a network round-trip that can fail with "Auth session missing"
 * even moments after a successful sign-in.
 */
export async function getUserProfile(
  uid: string,
  fallback?: ProfileFallback,
): Promise<UserProfile> {
  // .maybeSingle() returns null for 0 rows instead of erroring — lets us
  // detect a missing profile row and self-heal below.
  let { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    if (!fallback) throw new Error('User profile not found');

    // RLS allows the owner to insert their own profile (auth.uid() = id).
    const insert = await supabase
      .from('profiles')
      .insert({
        id: uid,
        email: fallback.email,
        display_name: fallback.displayName ?? null,
      })
      .select('*')
      .single();

    if (insert.error) throw insert.error;
    data = insert.data;
  }

  return {
    uid: data.id,
    email: data.email,
    displayName: data.display_name ?? null,
    onboardingComplete: data.onboarding_complete ?? false,
    subscriptionTier: data.subscription_tier ?? 'free',
    settings: normalizeSettings(data.settings),
  };
}

/**
 * Normalize a settings blob loaded from Postgres. Handles the v1→v2
 * reminderMode rename: legacy `'auto_start'` rows (the redundant
 * "automatically start countdown" option that was replaced by the
 * autoAssumeTaken switch) are migrated to the new default `'prompt'` so
 * existing users land on a coherent setting after the upgrade.
 */
function normalizeSettings(raw: unknown): UserSettings {
  const fallback: UserSettings = {
    autoAssumeTaken: false,
    autoAssumeTakenEnabledAt: null,
    notificationsEnabled: true,
    eliminationNotificationsEnabled: true,
    reminderMode: 'prompt',
  };
  if (!raw || typeof raw !== 'object') return fallback;
  const r = raw as Record<string, unknown>;
  const legacyMode = r.reminderMode;
  const mode: UserSettings['reminderMode'] =
    legacyMode === 'simple' || legacyMode === 'off' || legacyMode === 'prompt'
      ? legacyMode
      : 'prompt';
  return {
    autoAssumeTaken: typeof r.autoAssumeTaken === 'boolean' ? r.autoAssumeTaken : false,
    // Legacy rows where autoAssumeTaken was set true before this field existed
    // keep `null` here — the reconcile floor falls back to pill.createdAt,
    // which honors the original contract ("we'll record for you since the
    // pill was created").
    autoAssumeTakenEnabledAt:
      typeof r.autoAssumeTakenEnabledAt === 'string' ? r.autoAssumeTakenEnabledAt : null,
    notificationsEnabled:
      typeof r.notificationsEnabled === 'boolean' ? r.notificationsEnabled : true,
    eliminationNotificationsEnabled:
      typeof r.eliminationNotificationsEnabled === 'boolean'
        ? r.eliminationNotificationsEnabled
        : true,
    reminderMode: mode,
  };
}

export async function completeOnboarding(uid: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_complete: true })
    .eq('id', uid);
  if (error) throw new Error(error.message);
}

export async function updateUserSettings(
  uid: string,
  settings: UserSettings,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ settings })
    .eq('id', uid);
  if (error) throw new Error(error.message);
}

/**
 * Resolve `{ userId, email }` from a Supabase session, recovering from the
 * `userNotAvailableProxy` that auth-js installs when the encrypted user
 * blob in `userStorage` cannot be read (decryption failure, key rotation,
 * first launch after the encryption upgrade, etc.).
 *
 * The proxy throws on every property access except `__isUserNotAvailableProxy`
 * (see `node_modules/@supabase/auth-js/src/lib/helpers.ts`), so the only safe
 * test is reading that sentinel. On a hit, refetch the user via the access
 * token in SecureStore — that path is untouched by the user-blob encryption
 * layer, so it works even when local storage is corrupt. The next auth event
 * will repopulate `userStorage` automatically; nothing to persist here.
 */
async function resolveSessionUser(
  session: Session | null,
): Promise<{ userId: string; email: string } | null> {
  if (!session?.user) return null;

  if ((session.user as { __isUserNotAvailableProxy?: boolean }).__isUserNotAvailableProxy) {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { userId: data.user.id, email: data.user.email ?? '' };
  }

  return { userId: session.user.id, email: session.user.email ?? '' };
}

/**
 * Listen for auth state changes. Returns an unsubscribe function.
 * The callback receives the user ID (or null on sign-out).
 */
export function onAuthChanged(
  callback: (userId: string | null) => void,
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event: AuthChangeEvent, session: Session | null) => {
      // resolveSessionUser is async (it may refetch on the proxy path).
      // The auth-js listener does not await us, so fire-and-forget the
      // resolution and call back when it lands.
      resolveSessionUser(session).then((u) => callback(u?.userId ?? null));
    },
  );
  return () => subscription.unsubscribe();
}

/**
 * Get the current session. Used during app startup to hydrate auth state
 * without waiting for the onAuthStateChange event.
 */
export async function getSession(): Promise<{ userId: string; email: string } | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return resolveSessionUser(session);
}
