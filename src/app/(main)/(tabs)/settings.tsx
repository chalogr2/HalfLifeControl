import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Typography, Card } from '@/components/ui';
import { colors, spacing, borderRadius, MIN_TOUCH_TARGET } from '@/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { signOut, updateUserSettings } from '@/services/firebase/auth';
import type { ReminderMode } from '@/core/types';

const REMINDER_OPTIONS: { value: ReminderMode; title: string; description: string }[] = [
  {
    value: 'auto_start',
    title: 'Automatically start countdown at scheduled time',
    description: 'Begins a visual timer immediately when it is time to take your medication',
  },
  {
    value: 'prompt',
    title: 'Prompt to answer if pill was taken',
    description: 'Confirms your dosage/time for accurate consumption tracking',
  },
  {
    value: 'simple',
    title: 'Simple notification only',
    description: 'A brief/small notification alert informing you it is medication time',
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const tier = useSubscriptionStore((s) => s.tier);
  const [reminderMode, setReminderMode] = React.useState<ReminderMode>(
    (user?.settings?.reminderMode as ReminderMode) ?? 'auto_start',
  );

  const handleReminderChange = useCallback((mode: ReminderMode) => {
    setReminderMode(mode);
    if (user) {
      updateUserSettings(user.uid, { ...user.settings, reminderMode: mode });
    }
  }, [user]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Typography variant="headlineMd" style={styles.title}>Settings</Typography>

        {/* Reminders section */}
        <Typography variant="titleMd" style={styles.sectionTitle}>Reminders</Typography>
        <Typography variant="bodyMd" color="onSurfaceVariant" style={styles.sectionSub}>
          Customize how you would like to be notified about your medications.
        </Typography>

        <View style={styles.reminderOptions}>
          {REMINDER_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => handleReminderChange(opt.value)}
              style={({ pressed }) => pressed && styles.pressed}
              accessibilityRole="radio"
              accessibilityState={{ selected: reminderMode === opt.value }}
              accessibilityLabel={`${opt.title}. ${opt.description}`}
            >
              <Card
                variant={reminderMode === opt.value ? 'outlined' : 'elevated'}
                style={[
                  styles.reminderCard,
                  reminderMode === opt.value && styles.reminderCardActive,
                ]}
              >
                <View style={styles.reminderRow}>
                  <View style={styles.radioOuter}>
                    {reminderMode === opt.value && <View style={styles.radioInner} />}
                  </View>
                  <View style={styles.reminderContent}>
                    <Typography variant="titleSm" color="onSurface">
                      {opt.title}
                    </Typography>
                    <Typography variant="bodyMd" color="onSurfaceVariant">
                      {opt.description}
                    </Typography>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>

        {/* Subscription */}
        {tier === 'free' ? (
          <Pressable
            style={styles.proCard}
            onPress={() => router.push('/(main)/subscription/paywall')}
            accessibilityRole="button"
            accessibilityLabel="Upgrade to Pro. Unlock unlimited scheduled pills and future features."
          >
            <View style={styles.proCardContent}>
              <Typography variant="titleMd" color="onPrimary">Upgrade to Pro</Typography>
              <Typography variant="bodyMd" color="onPrimaryContainer">
                Unlock unlimited scheduled pills and future features.
              </Typography>
            </View>
            <Typography variant="titleLg" color="onPrimary">→</Typography>
          </Pressable>
        ) : (
          <Card variant="elevated" style={styles.proActiveCard}>
            <View style={styles.proBadge}>
              <Typography variant="labelSm" color="onPrimary">PRO</Typography>
            </View>
            <Typography variant="titleMd">Pro Plan Active</Typography>
            <Typography variant="bodyMd" color="onSurfaceVariant">
              You have access to all features.
            </Typography>
          </Card>
        )}

        {/* Legal */}
        <Pressable
          style={styles.legalBtn}
          accessibilityRole="button"
          accessibilityLabel="Terms of Service"
        >
          <Typography variant="bodyLg" color="onSurface">Terms of Service</Typography>
          <Typography variant="bodyLg" color="onSurfaceVariant">›</Typography>
        </Pressable>

        <Pressable
          style={styles.legalBtn}
          accessibilityRole="button"
          accessibilityLabel="Privacy Policy"
        >
          <Typography variant="bodyLg" color="onSurface">Privacy Policy</Typography>
          <Typography variant="bodyLg" color="onSurfaceVariant">›</Typography>
        </Pressable>

        {/* Account info */}
        <View style={styles.accountSection}>
          <Typography variant="labelMd" color="onSurfaceVariant">
            Signed in as {user?.email ?? 'unknown'}
          </Typography>
        </View>

        {/* Sign out */}
        <Pressable
          style={styles.signOutBtn}
          onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Typography variant="labelLg" color="error">Sign Out</Typography>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[24],
  },
  title: {
    paddingTop: spacing[2],
    marginBottom: spacing[6],
  },
  sectionTitle: {
    marginBottom: spacing[1],
  },
  sectionSub: {
    marginBottom: spacing[4],
  },
  reminderOptions: {
    gap: spacing[3],
    marginBottom: spacing[8],
  },
  reminderCard: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  reminderCardActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  reminderRow: {
    flexDirection: 'row',
    gap: spacing[3],
    alignItems: 'flex-start',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  reminderContent: {
    flex: 1,
    gap: spacing[1],
  },
  proCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[5],
    marginBottom: spacing[4],
  },
  proCardContent: {
    flex: 1,
    gap: spacing[1],
    marginRight: spacing[3],
  },
  proActiveCard: {
    marginBottom: spacing[4],
    gap: spacing[1],
  },
  proBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    marginBottom: spacing[1],
  },
  legalBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    marginBottom: spacing[3],
    minHeight: MIN_TOUCH_TARGET,
  },
  accountSection: {
    alignItems: 'center',
    paddingVertical: spacing[4],
    marginTop: spacing[4],
  },
  signOutBtn: {
    alignItems: 'center',
    paddingVertical: spacing[4],
    backgroundColor: colors.errorContainer,
    borderRadius: borderRadius.lg,
    marginTop: spacing[2],
  },
  pressed: {
    opacity: 0.85,
  },
});
