import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Typography, Button } from '@/components/ui';
import { colors, spacing, borderRadius } from '@/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  const handleScheduled = () => {
    // Navigate to add pill flow (scheduled mode)
    router.push('/(main)/pill/add?type=scheduled');
  };

  const handleRandom = () => {
    // Navigate to add pill flow (one-time mode)
    router.push('/(main)/pill/add?type=random');
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
          onPress={handleRandom}
          accessibilityRole="button"
          accessibilityLabel="No, I just want to track a pill now. Quick entry for occasional relief."
        >
          <View style={styles.optionContent}>
            <Typography variant="titleMd" color="onSurface">
              No, I just want to track a pill now
            </Typography>
            <Typography variant="bodyMd" color="onSurfaceVariant">
              Quick entry for occasional relief
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
