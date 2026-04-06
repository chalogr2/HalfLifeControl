import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Typography, Button } from '@/components/ui';
import { colors, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import { completeOnboarding } from '@/services/supabase/auth';

export default function WelcomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [skipping, setSkipping] = useState(false);

  const handleScheduled = () => {
    // Navigate to add pill flow (scheduled mode)
    router.push('/(main)/pill/add?type=scheduled');
  };

  const handleSkipToDashboard = async () => {
    // "No" → mark onboarding complete, go straight to dashboard
    if (!user || skipping) return;
    setSkipping(true);
    try {
      await completeOnboarding(user.uid);
      useAuthStore.getState().setUser({ ...user, onboardingComplete: true });
      router.replace('/(main)/(tabs)/dashboard');
    } finally {
      setSkipping(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Brand */}
      <Typography variant="titleMd" color="primary" style={styles.brand}>
        HalfLifeControl
      </Typography>

      {/* Illustration area */}
      <View style={styles.illustrationContainer}>
        <View style={styles.illustrationPlaceholder}>
          <Typography variant="displayLg" align="center" style={styles.pillEmoji}>
            💊
          </Typography>
        </View>
      </View>

      {/* Headline */}
      <View style={styles.textContent}>
        <Typography variant="headlineLg" align="center">
          Let's manage your{'\n'}medications{'\n'}together.
        </Typography>
        <Typography variant="bodyLg" color="onSurfaceVariant" align="center" style={styles.subtitle}>
          Start by setting up your daily pill stack or tracking a single pill.
        </Typography>
      </View>

      {/* CTAs */}
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.optionCard, pressed && styles.optionPressed]}
          onPress={handleScheduled}
          accessibilityRole="button"
          accessibilityLabel="Yes, I take pills on a schedule. Set up your daily routine."
        >
          <View style={styles.optionContent}>
            <Typography variant="titleMd" color="onSurface">
              Yes, I take pills on a schedule
            </Typography>
            <Typography variant="bodyMd" color="onSurfaceVariant">
              Set up your daily routine
            </Typography>
          </View>
          <Typography variant="titleLg" color="primary">›</Typography>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.optionCard, styles.optionCardSecondary, pressed && styles.optionPressed]}
          onPress={handleSkipToDashboard}
          disabled={skipping}
          accessibilityRole="button"
          accessibilityLabel="No, skip to dashboard. You can add pills later."
        >
          <View style={styles.optionContent}>
            <Typography variant="titleMd" color="onSurface">
              No, I'll add pills later
            </Typography>
            <Typography variant="bodyMd" color="onSurfaceVariant">
              Skip to your dashboard
            </Typography>
          </View>
          <Typography variant="titleLg" color="primary">›</Typography>
        </Pressable>
      </View>

      {/* Login link */}
      <Pressable
        onPress={() => router.replace('/(auth)/login')}
        style={styles.loginLink}
        accessibilityRole="link"
        accessibilityLabel="Already have an account? Log in"
      >
        <Typography variant="bodyMd" color="onSurfaceVariant">
          Already have an account?{' '}
        </Typography>
        <Typography variant="labelLg" color="primary">
          Log in
        </Typography>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[6],
  },
  brand: {
    marginTop: spacing[4],
  },
  illustrationContainer: {
    alignItems: 'center',
    marginTop: spacing[6],
  },
  illustrationPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillEmoji: {
    fontSize: 56,
  },
  textContent: {
    alignItems: 'center',
    marginTop: spacing[6],
    gap: spacing[3],
  },
  subtitle: {
    maxWidth: 280,
  },
  actions: {
    marginTop: spacing[8],
    gap: spacing[3],
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.xl,
    padding: spacing[5],
  },
  optionCardSecondary: {
    backgroundColor: colors.surfaceContainer,
  },
  optionPressed: {
    opacity: 0.85,
  },
  optionContent: {
    flex: 1,
    gap: 2,
  },
  loginLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 'auto',
    paddingBottom: spacing[6],
    paddingTop: spacing[4],
  },
});
