import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { secureSessionStorage, userMetadataStorage } from './sessionStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env',
  );
}

// The Supabase session is split across two stores so that the high-value
// items (refresh + access tokens, PKCE code-verifier) live in
// hardware-backed secure storage, while the larger user-metadata object
// stays in AsyncStorage. See `sessionStorage.ts` for the rationale.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureSessionStorage,
    userStorage: userMetadataStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
