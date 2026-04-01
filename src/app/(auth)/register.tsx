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
import { useRouter } from 'expo-router';
import { Typography, Button, Input } from '@/components/ui';
import { colors, spacing, borderRadius } from '@/theme';
import { signUp } from '@/services/firebase/auth';
import { signInWithGoogle, isGoogleCancellation } from '@/services/firebase/googleAuth';
import { useAuthStore } from '@/stores/useAuthStore';

export default function RegisterScreen() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirm?: string;
    terms?: string;
  }>({});

  function validate(): boolean {
    const newErrors: typeof errors = {};
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Enter a valid email';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 8) newErrors.password = 'At least 8 characters';
    if (password !== confirmPassword) newErrors.confirm = 'Passwords do not match';
    if (!agreedToTerms) newErrors.terms = 'You must accept the terms';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;
    setLoading(true);
    try {
      const profile = await signUp(email.trim(), password);
      setUser(profile);
    } catch (err: any) {
      const code = err?.code;
      if (code === 'auth/email-already-in-use') {
        Alert.alert('Account Exists', 'An account with this email already exists. Try logging in.');
      } else if (code === 'auth/weak-password') {
        Alert.alert('Weak Password', 'Please use a stronger password.');
      } else {
        Alert.alert('Error', 'Something went wrong. Please try again.');
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
        Alert.alert('Google Sign-In Failed', 'Something went wrong. Please try again.');
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
              Create Account
            </Typography>
            <Typography variant="bodyLg" color="onSurfaceVariant" align="center">
              Start tracking your medications
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

              <Input
                label="Password"
                placeholder="At least 8 characters"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                error={errors.password}
              />

              <Input
                label="Confirm Password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                error={errors.confirm}
              />

              {/* Terms acceptance */}
              <Pressable
                style={styles.termsRow}
                onPress={() => setAgreedToTerms(!agreedToTerms)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreedToTerms }}
                accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
              >
                <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                  {agreedToTerms && (
                    <Typography variant="labelSm" color="onPrimary">
                      ✓
                    </Typography>
                  )}
                </View>
                <Typography variant="bodyMd" color="onSurfaceVariant" style={styles.termsText}>
                  I agree to the{' '}
                  <Typography
                    variant="bodyMd"
                    color="primary"
                    style={styles.bold}
                    onPress={() => router.push({ pathname: '/legal', params: { type: 'terms' } })}
                  >
                    Terms of Service
                  </Typography>
                  {' '}and{' '}
                  <Typography
                    variant="bodyMd"
                    color="primary"
                    style={styles.bold}
                    onPress={() => router.push({ pathname: '/legal', params: { type: 'privacy' } })}
                  >
                    Privacy Policy
                  </Typography>
                </Typography>
              </Pressable>
              {errors.terms && (
                <Typography variant="bodySm" color="error">
                  {errors.terms}
                </Typography>
              )}

              <Button
                title="Create Account"
                onPress={handleRegister}
                loading={loading}
                style={styles.registerButton}
              />
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Typography variant="labelMd" color="outline" style={styles.dividerLabel}>
                OR CONTINUE WITH
              </Typography>
              <View style={styles.dividerLine} />
            </View>

            {/* Social sign-in */}
            <View style={styles.socialRow}>
              <Pressable
                style={[styles.socialButton, styles.socialButtonEnabled]}
                onPress={handleGoogleSignIn}
                disabled={googleLoading}
                accessibilityRole="button"
                accessibilityLabel="Sign up with Google"
              >
                <Typography variant="labelLg" color="onSurface">
                  {googleLoading ? 'Signing in...' : 'Google'}
                </Typography>
              </Pressable>
              <Pressable
                style={styles.socialButton}
                disabled
                accessibilityRole="button"
                accessibilityLabel="Sign up with Apple, available on iOS"
              >
                <Typography variant="labelLg" color="outline">
                  Apple
                </Typography>
                <Typography variant="labelSm" color="outline">
                  iOS only
                </Typography>
              </Pressable>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Typography variant="bodyLg" color="onSurfaceVariant">
              Already have an account?{' '}
            </Typography>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="link"
              accessibilityLabel="Go to login screen"
            >
              <Typography variant="bodyLg" color="primary" style={styles.bold}>
                Login
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
    gap: spacing[5],
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsText: {
    flex: 1,
  },
  registerButton: {
    marginTop: spacing[2],
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
  dividerLabel: {
    marginHorizontal: spacing[4],
    letterSpacing: 2,
  },
  socialRow: {
    flexDirection: 'row',
    gap: spacing[4],
  },
  socialButton: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.xl,
    opacity: 0.5,
  },
  socialButtonEnabled: {
    opacity: 1,
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
