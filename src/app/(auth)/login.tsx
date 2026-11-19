import { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Typography, Button, Input } from '@/components/ui';
import { colors, spacing, borderRadius } from '@/theme';
import { signIn } from '@/services/supabase/auth';
import { signInWithGoogle, isGoogleCancellation } from '@/services/supabase/googleAuth';
import { useAuthStore } from '@/stores/useAuthStore';

export default function LoginScreen() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function validate(): boolean {
    const newErrors: typeof errors = {};
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Enter a valid email';
    if (!password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleLogin() {
    if (!validate()) return;
    setLoading(true);
    try {
      const profile = await signIn(email.trim(), password);
      setUser(profile);
    } catch (err: any) {
      const code = err?.code;
      if (code === 'invalid_credentials') {
        Alert.alert('Login Failed', 'Incorrect email or password.');
      } else if (code === 'email_not_confirmed') {
        Alert.alert('Email Not Confirmed', 'Check your inbox for the confirmation link.');
      } else if (code === 'over_request_rate_limit') {
        Alert.alert('Too Many Attempts', 'Please wait a moment and try again.');
      } else {
        Alert.alert('Login Failed', err?.message ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    try {
      const profile = await signInWithGoogle();
      setUser(profile);
    } catch (err: unknown) {
      if (!isGoogleCancellation(err)) {
        Alert.alert(
          'Google Sign-In Failed',
          err instanceof Error && err.message ? err.message : 'Something went wrong. Please try again.',
        );
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Typography variant="displaySm" color="primary" align="center">
              Login
            </Typography>
            <Typography variant="bodyLg" color="onSurfaceVariant" align="center">
              Welcome back to HalfLifeControl
            </Typography>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <View style={styles.form}>
              <Input
                label="Email Address"
                placeholder="name@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={errors.email}
              />

              <View>
                <View style={styles.passwordHeader}>
                  <Typography variant="labelLg" color="primary">
                    Password
                  </Typography>
                  <Pressable
                    onPress={() => router.push('/(auth)/forgot-password')}
                    accessibilityRole="link"
                    accessibilityLabel="Forgot password"
                  >
                    <Typography variant="labelLg" color="primary">
                      Forgot Password?
                    </Typography>
                  </Pressable>
                </View>
                <Input
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                  error={errors.password}
                />
              </View>

              <Button
                title="Login"
                onPress={handleLogin}
                loading={loading}
                style={styles.loginButton}
              />
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Typography variant="labelMd" color="outline" style={styles.dividerText}>
                OR
              </Typography>
              <View style={styles.dividerLine} />
            </View>

            {/* Social sign-in. Apple is added here once it's enabled (iOS). */}
            <Pressable
              style={({ pressed }) => [
                styles.googleButton,
                (pressed || googleLoading) && styles.googleButtonPressed,
              ]}
              onPress={handleGoogleSignIn}
              disabled={googleLoading}
              accessibilityRole="button"
              accessibilityLabel="Sign in with Google"
              accessibilityState={{ busy: googleLoading }}
            >
              <Ionicons name="logo-google" size={20} color={colors.onSurface} />
              <Typography variant="labelLg" color="onSurface">
                {googleLoading ? 'Signing in...' : 'Continue with Google'}
              </Typography>
            </Pressable>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Typography variant="bodyLg" color="onSurfaceVariant">
              Don't have an account?{' '}
            </Typography>
            <Pressable
              onPress={() => router.push('/(auth)/register')}
              accessibilityRole="link"
              accessibilityLabel="Go to register screen"
            >
              <Typography variant="bodyLg" color="primary" style={styles.bold}>
                Register
              </Typography>
            </Pressable>
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
  form: {
    gap: spacing[6],
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1],
    paddingHorizontal: spacing[2],
  },
  loginButton: {
    marginTop: spacing[4],
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing[8],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.outlineVariant + '66',
  },
  dividerText: {
    marginHorizontal: spacing[4],
    letterSpacing: 2,
  },
  googleButton: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.xl,
  },
  googleButtonPressed: {
    opacity: 0.7,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing[8],
  },
  bold: {
    fontWeight: '700',
  },
});
