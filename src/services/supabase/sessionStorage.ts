/**
 * Storage adapters for the Supabase auth client.
 *
 * The Supabase session is split across two storage media via Supabase's
 * built-in `storage` + `userStorage` options:
 *
 *   1. `secureSessionStorage` (this module, expo-secure-store backed):
 *        - access_token, refresh_token, expires_at, token_type
 *        - PKCE code-verifier
 *      These items are small (~1KB total) and are the high-value targets:
 *      anyone who lifts a refresh token can impersonate the user under valid
 *      RLS. expo-secure-store stores them in hardware-backed iOS Keychain /
 *      Android Keystore — encrypted by the OS, not by our JS code.
 *
 *   2. `userMetadataStorage` (AsyncStorage):
 *        - { user: <user object> }
 *      The user object is larger (1–3KB depending on metadata) and is not
 *      itself sensitive (no tokens, no secrets — just the data the auth
 *      server returns from /auth/v1/user). Putting it in AsyncStorage keeps
 *      us safely under SecureStore's per-value size limit (~2KB on Android).
 *
 * Why not encrypt AsyncStorage with our own AES key? We tried. The
 * AES-via-expo-crypto + AsyncStorage path failed in production with
 * intermittent "auth.uid() is null" errors that we couldn't reproduce
 * deterministically without on-device instrumentation. Going through
 * expo-secure-store removes our JS crypto layer from the critical path
 * entirely — round-trip consistency is the OS's problem.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

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

export const userMetadataStorage = AsyncStorage;
