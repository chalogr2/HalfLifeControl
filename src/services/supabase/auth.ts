import { supabase } from './config';
import { clearUserCache } from '@/services/cache';
import type { UserProfile, UserSettings } from '@/core/types';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export async function signUp(email: string, password: string): Promise<UserProfile> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Sign-up succeeded but no user returned');

  // The handle_new_user trigger creates the profile row automatically.
  // Wait briefly for the trigger to complete, then fetch the profile.
  // On a fresh signup the session is available immediately (email confirmation is off in dev).
  return getUserProfile(data.user.id);
}

export async function signIn(email: string, password: string): Promise<UserProfile> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Sign-in succeeded but no user returned');

  return getUserProfile(data.user.id);
}

export async function signOut(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;

  // Cancel all scheduled notifications before signing out
  const { cancelAllReminders } = await import('@/services/notifications');
  await cancelAllReminders().catch(() => {});

  await supabase.auth.signOut();

  if (uid) await clearUserCache(uid).catch(() => {});
}

export async function resetPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw new Error(error.message);
}

export async function getUserProfile(uid: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .single();

  if (error || !data) throw new Error(error?.message ?? 'User profile not found');

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
 * Listen for auth state changes. Returns an unsubscribe function.
 * The callback receives the user ID (or null on sign-out).
 */
export function onAuthChanged(
  callback: (userId: string | null) => void,
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event: AuthChangeEvent, session: Session | null) => {
      callback(session?.user?.id ?? null);
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
  if (!session?.user) return null;
  return { userId: session.user.id, email: session.user.email ?? '' };
}
