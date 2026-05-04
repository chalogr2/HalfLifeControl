/**
 * Storage adapters for the Supabase auth client.
 *
 * The Supabase session is split across two storage media via Supabase's
 * built-in `storage` + `userStorage` options:
 *
 *   1. `secureSessionStorage` (expo-secure-store backed):
 *        - access_token, refresh_token, expires_at, token_type
 *        - PKCE code-verifier
 *      These items are small (~1KB total) and are the high-value targets:
 *      anyone who lifts a refresh token can impersonate the user under valid
 *      RLS. expo-secure-store stores them in hardware-backed iOS Keychain /
 *      Android Keystore — encrypted by the OS, not by our JS code.
 *
 *   2. `userMetadataStorage` (AES-256-GCM-encrypted AsyncStorage):
 *        - { user: <user object> } — email, app_metadata, user_metadata, etc.
 *      The user blob is 1–3 KB depending on metadata, which puts it outside
 *      SecureStore's per-value size limit (~2 KB on Android), so it lives
 *      in AsyncStorage. Email + auth metadata are PII at rest, so we wrap
 *      AsyncStorage with the same AES-256-GCM layer the medication cache
 *      uses (`src/services/secureStorage.ts`).
 *
 * This is *not* the same design as the Q1 2026 attempt that wrapped the
 * entire Supabase storage adapter in AES. That earlier path put encryption
 * in front of the high-frequency token refresh loop — when round-trip
 * consistency glitched, RLS broke. Here we encrypt only the low-frequency
 * user blob:
 *   - read once per session start
 *   - written once per auth event
 *   - never consulted by RLS (RLS validates the access token, which lives
 *     in `secureSessionStorage` and is unaffected by this layer)
 * and on decryption failure Supabase substitutes a `userNotAvailableProxy`
 * for `session.user` — the cold-start fallback in `auth.ts` (`getSession`
 * and `onAuthChanged`) detects the proxy and recovers via a one-shot
 * `supabase.auth.getUser()` call.
 */
import * as SecureStore from 'expo-secure-store';
import { secureGet, secureSet, secureRemove } from '@/services/secureStorage';

// expo-secure-store keys must match /^[A-Za-z0-9._-]+$/. Supabase keys
// (sb-<project-ref>-auth-token, ...-code-verifier) already satisfy this,
// but sanitize defensively in case the storage key changes.
function sanitize(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

export const secureSessionStorage = {
  getItem: async (key: string): Promise<string | null> => {
    return SecureStore.getItemAsync(sanitize(key));
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(sanitize(key), value);
  },
  removeItem: async (key: string): Promise<void> => {
    await SecureStore.deleteItemAsync(sanitize(key));
  },
};

/**
 * Encrypted adapter for the Supabase user metadata blob.
 *
 * `secureGet` already auto-migrates legacy plaintext entries (values that
 * begin with `{` or `[` are re-encrypted in place on first read), so the
 * upgrade is transparent — existing users do not get signed out.
 *
 * We deliberately do NOT call into Supabase from this adapter: the auth
 * client awaits storage methods during its own internal calls, so
 * re-entering Supabase from inside a storage call risks deadlock or
 * recursion. Recovery from corruption lives one layer up in `auth.ts`.
 */
export const userMetadataStorage = {
  getItem: async (key: string): Promise<string | null> => {
    return secureGet(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await secureSet(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    await secureRemove(key);
  },
};
