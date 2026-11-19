import { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Typography, Button, Input } from '@/components/ui';
import { completeAuthFromUrl, updatePassword } from '@/services/supabase/auth';
import { useAuthStore } from '@/stores/useAuthStore';
import { colors, spacing } from '@/theme';

type Phase = 'verifying' | 'form' | 'invalid';

/**
 * Landing route for the password-recovery email link:
 * `halflifecontrol://reset-password?code=...`.
 *
 * Lives at the root (not in `(auth)`) on purpose: exchanging the code signs
 * the user in, and the AuthGate bounces authenticated users out of `(auth)`
 * — which would yank them away before they set the new password. The gate
 * whitelists this route instead.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const user = useAuthStore((s) => s.user);

  const [phase, setPhase] = useState<Phase>('verifying');
  const [linkError, setLinkError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams();
    if (params.code) query.set('code', params.code);
    if (params.error_description) query.set('error_description', params.error_description);

    completeAuthFromUrl(`?${query.toString()}`)
      .then(() => setPhase('form'))
      .catch((e: unknown) => {
        setLinkError(
          e instanceof Error && e.message
            ? e.message
            : 'This reset link is invalid or has expired.',
        );
        setPhase('invalid');
      });
  }, [params.code, params.error_description]);

  function validate(): boolean {
    const next: typeof errors = {};
    // Same rule as the Register screen.
    if (password.length < 8) next.password = 'At least 8 characters';
    if (confirm !== password) next.confirm = 'Passwords do not match';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      await updatePassword(password);
      Alert.alert('Password updated', 'You are now signed in with your new password.');
      router.replace(
        user && !user.onboardingComplete ? '/(onboarding)/welcome' : '/(main)/(tabs)/dashboard',
      );
    } catch (e: any) {
      if (e?.code === 'same_password') {
        setErrors({ password: 'Choose a password different from your current one' });
      } else if (e?.code === 'weak_password') {
        setErrors({ password: e.message ?? 'That password is too weak' });
      } else {
        Alert.alert('Error', e?.message ?? 'Could not update your password. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Typography variant="headlineLg" color="primary" align="center">
              {phase === 'invalid' ? 'Link Expired' : 'Set New Password'}
            </Typography>
            {phase === 'form' && (
              <Typography variant="bodyLg" color="onSurfaceVariant" align="center">
                Choose a new password for your account.
              </Typography>
            )}
          </View>

          <View style={styles.card}>
            {phase === 'verifying' && (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Typography variant="bodyLg" color="onSurfaceVariant" align="center">
                  Checking your reset link…
                </Typography>
              </View>
            )}

            {phase === 'invalid' && (
              <View style={styles.form}>
                <Typography variant="bodyLg" color="onSurfaceVariant" align="center">
                  {linkError} Reset links work once and expire after an hour. Request a new one
                  from the login screen, on this phone.
                </Typography>
                <Button
                  title="Request a New Link"
                  onPress={() => router.replace('/(auth)/forgot-password')}
                />
              </View>
            )}

            {phase === 'form' && (
              <View style={styles.form}>
                <Input
                  label="New Password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  error={errors.password}
                />
                <Input
                  label="Confirm Password"
                  placeholder="Type it again"
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  error={errors.confirm}
                />
                <Button title="Save Password" onPress={handleSave} loading={saving} />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[8],
  },
  header: {
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[10],
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 32,
    padding: spacing[8],
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 32,
    elevation: 4,
  },
  centered: {
    alignItems: 'center',
    gap: spacing[4],
  },
  form: {
    gap: spacing[6],
  },
});
