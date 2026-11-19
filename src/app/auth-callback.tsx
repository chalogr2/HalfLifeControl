import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Typography, Button } from '@/components/ui';
import { completeAuthFromUrl } from '@/services/supabase/auth';
import { colors, spacing } from '@/theme';

/**
 * Landing route for `halflifecontrol://auth-callback?code=...` (Google OAuth).
 *
 * Usually `signInWithGoogle` already received this URL from the auth session
 * and is exchanging the code; `completeAuthFromUrl` dedupes, so calling it
 * again here just joins that exchange. This route matters when the router got
 * the link but the browser session didn't (Android 'dismiss' quirk, or the app
 * was relaunched by the link). On success the root AuthGate sees the new
 * session and navigates away — this screen never navigates on success itself.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams();
    if (params.code) query.set('code', params.code);
    if (params.error_description) query.set('error_description', params.error_description);

    completeAuthFromUrl(`?${query.toString()}`).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
    });
  }, [params.code, params.error_description]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {error ? (
          <>
            <Typography variant="headlineSm" color="primary" align="center">
              Sign-in didn't finish
            </Typography>
            <Typography variant="bodyLg" color="onSurfaceVariant" align="center">
              {error}
            </Typography>
            <Button title="Back to Login" onPress={() => router.replace('/(auth)/login')} />
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Typography variant="bodyLg" color="onSurfaceVariant" align="center">
              Signing you in…
            </Typography>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    gap: spacing[4],
  },
});
