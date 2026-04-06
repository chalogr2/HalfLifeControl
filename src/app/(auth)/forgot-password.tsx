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
import { colors, spacing } from '@/theme';
import { resetPassword } from '@/services/supabase/auth';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleReset() {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Enter a valid email');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found') {
        // Don't reveal that the email doesn't exist (security)
        setSent(true);
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
          <View style={styles.header}>
            <Typography variant="headlineLg" color="primary" align="center">
              Reset Password
            </Typography>
            <Typography variant="bodyLg" color="onSurfaceVariant" align="center">
              {sent
                ? 'Check your email for a password reset link.'
                : "Enter your email and we'll send you a reset link."}
            </Typography>
          </View>

          <View style={styles.card}>
            {!sent ? (
              <View style={styles.form}>
                <Input
                  label="Email Address"
                  placeholder="name@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  error={error}
                />
                <Button
                  title="Send Reset Link"
                  onPress={handleReset}
                  loading={loading}
                />
              </View>
            ) : (
              <Button
                title="Back to Login"
                onPress={() => router.back()}
              />
            )}
          </View>

          {!sent && (
            <View style={styles.footer}>
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="link"
                accessibilityLabel="Back to login"
              >
                <Typography variant="bodyLg" color="primary" style={styles.bold}>
                  Back to Login
                </Typography>
              </Pressable>
            </View>
          )}
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
  footer: {
    alignItems: 'center',
    marginTop: spacing[8],
  },
  bold: {
    fontWeight: '700',
  },
});
