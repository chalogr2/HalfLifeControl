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
import { signIn, getUserProfile } from '@/services/firebase/auth';
import { useAuthStore } from '@/stores/useAuthStore';

export default function LoginScreen() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
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
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        Alert.alert('Login Failed', 'Incorrect email or password.');
      } else if (code === 'auth/too-many-requests') {
        Alert.alert('Too Many Attempts', 'Please wait a moment and try again.');
      } else {
        Alert.alert('Error', 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
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
                  <Pressable onPress={() => router.push('/(auth)/forgot-password')}>
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
                OR CONTINUE WITH
              </Typography>
              <View style={styles.dividerLine} />
            </View>

            {/* Social buttons — disabled for now, enabled in Phase 6 */}
            <View style={styles.socialRow}>
              <Pressable style={styles.socialButton} disabled>
                <Typography variant="labelLg" color="onSurface">
                  Google
                </Typography>
              </Pressable>
              <Pressable style={styles.socialButton} disabled>
                <Typography variant="labelLg" color="onSurface">
                  Apple
                </Typography>
              </Pressable>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Typography variant="bodyLg" color="onSurfaceVariant">
              Don't have an account?{' '}
            </Typography>
            <Pressable onPress={() => router.push('/(auth)/register')}>
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing[8],
  },
  bold: {
    fontWeight: '700',
  },
});
