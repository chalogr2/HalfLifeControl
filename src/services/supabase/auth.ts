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

export async function resetPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
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
    settings: data.settings ?? {
      autoAssumeTaken: false,
      notificationsEnabled: true,
      reminderMode: 'auto_start',
    },
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

export async function updateSubscriptionTier(
  uid: string,
  tier: 'free' | 'pro',
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ subscription_tier: tier })
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
