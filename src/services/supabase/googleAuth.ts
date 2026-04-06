/**
 * Google Sign-In stub — deferred to post-migration follow-up.
 *
 * Supabase supports Google OAuth natively, but wiring it requires
 * deep-link configuration and redirect URI verification on physical
 * devices. This stub preserves the import surface so auth screens
 * compile without changes.
 */
import type { UserProfile } from '@/core/types';

export async function signInWithGoogle(): Promise<UserProfile> {
  throw new Error(
    'Google Sign-In is not yet available. It will be enabled in a follow-up update.',
  );
}

export function isGoogleCancellation(_error: unknown): boolean {
  return false;
}
