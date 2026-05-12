import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Typography, Card } from '@/components/ui';
import { colors, spacing, borderRadius, MIN_TOUCH_TARGET } from '@/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { signOut, updateUserSettings } from '@/services/supabase/auth';
import type { ReminderMode } from '@/core/types';

const REMINDER_OPTIONS: { value: ReminderMode; title: string; description: string }[] = [
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
  {
    value: 'off',
    title: 'Notifications off',
    description: 'No reminders sent. You will mark doses manually from the dashboard.',
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const tier = useSubscriptionStore((s) => s.tier);
  const [reminderMode, setReminderMode] = React.useState<ReminderMode>(
    (user?.settings?.reminderMode as ReminderMode) ?? 'prompt',
  );
  const [autoAssumeTaken, setAutoAssumeTaken] = React.useState<boolean>(
    user?.settings?.autoAssumeTaken ?? false,
  );
  const [eliminationNotifsEnabled, setEliminationNotifsEnabled] = React.useState<boolean>(
    user?.settings?.eliminationNotificationsEnabled ?? true,
  );

  // `prompt` is incoherent with autoAssumeTaken (we'd be asking the user to
  // confirm a dose we already auto-recorded), so the row is locked while
  // the switch is on.
  const promptDisabled = autoAssumeTaken;

  const handleReminderChange = useCallback((mode: ReminderMode) => {
    if (mode === 'prompt' && promptDisabled) return;
    setReminderMode(mode);
    if (user) {
      const nextSettings = { ...user.settings, reminderMode: mode };
      useAuthStore.getState().setUser({ ...user, settings: nextSettings });
      updateUserSettings(user.uid, nextSettings);
    }
  }, [user, promptDisabled]);

  const handleAutoAssumeToggle = useCallback((value: boolean) => {
    setAutoAssumeTaken(value);
    if (!user) return;
    // If the user is on `prompt` and turns autoAssume on, drop them to
    // `simple` — the prompt would never fire because the dose is already
    // being recorded automatically.
    const nextReminderMode: ReminderMode =
      value && user.settings.reminderMode === 'prompt'
        ? 'simple'
        : user.settings.reminderMode;
    if (nextReminderMode !== reminderMode) setReminderMode(nextReminderMode);
    const nextSettings = {
      ...user.settings,
      autoAssumeTaken: value,
      reminderMode: nextReminderMode,
    };
    // Optimistic local-store update so dependent effects (notifications
    // scheduler, reconcile) pick it up before the Supabase write returns.
    useAuthStore.getState().setUser({ ...user, settings: nextSettings });
    updateUserSettings(user.uid, nextSettings);
  }, [user, reminderMode]);

  const handleEliminationNotifsToggle = useCallback((value: boolean) => {
    setEliminationNotifsEnabled(value);
    if (!user) return;
    const nextSettings = { ...user.settings, eliminationNotificationsEnabled: value };
    useAuthStore.getState().setUser({ ...user, settings: nextSettings });
    updateUserSettings(user.uid, nextSettings);
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
        <Typography variant="headlineLg" color="primary" style={styles.title}>Settings</Typography>

        {/* Reminders section */}
        <Typography variant="titleMd" color="primary" style={styles.sectionTitle}>Reminders</Typography>
        <Typography variant="bodyMd" color="onSurfaceVariant" style={styles.sectionSub}>
          Customize how you would like to be notified about your medications.
        </Typography>

        <View style={styles.reminderOptions}>
          {REMINDER_OPTIONS.map((opt) => {
            const disabled = opt.value === 'prompt' && promptDisabled;
            const isSelected = reminderMode === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => handleReminderChange(opt.value)}
                disabled={disabled}
                style={({ pressed }) => [
                  pressed && !disabled && styles.pressed,
                  disabled && styles.disabled,
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected, disabled }}
                accessibilityLabel={
                  disabled
                    ? `${opt.title}. Disabled while Auto-assume taken is on.`
                    : `${opt.title}. ${opt.description}`
                }
              >
                <Card
                  variant={isSelected ? 'outlined' : 'elevated'}
                  style={[
                    styles.reminderCard,
                    isSelected && styles.reminderCardActive,
                  ]}
                >
                  <View style={styles.reminderRow}>
                    <View style={styles.radioOuter}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <View style={styles.reminderContent}>
                      <Typography variant="titleMd" color="onSurface">
                        {opt.title}
                      </Typography>
                      <Typography variant="bodyLg" color="onSurfaceVariant">
                        {disabled
                          ? 'Disabled while Auto-assume taken is on.'
                          : opt.description}
                      </Typography>
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>

        {/* Auto-assume taken */}
        <Card variant="elevated" style={styles.toggleCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleContent}>
              <Typography variant="titleMd" color="onSurface">
                Automatically take pill
              </Typography>
              <Typography variant="bodyLg" color="onSurfaceVariant">
                Records doses on your behalf at each scheduled time. Disables the prompt option above. Background recording while the app is closed is coming in a future update.
              </Typography>
            </View>
            <Switch
              value={autoAssumeTaken}
              onValueChange={handleAutoAssumeToggle}
              accessibilityLabel="Automatically take pill"
            />
          </View>
        </Card>

        {/* Dose-elimination notification — last toggle, carries the section break */}
        <Card variant="elevated" style={[styles.toggleCard, styles.toggleCardLast]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleContent}>
              <Typography variant="titleMd" color="onSurface">
                Notify when dose clears
              </Typography>
              <Typography variant="bodyLg" color="onSurfaceVariant">
                Get a banner when each dose has cleared from your system.
              </Typography>
            </View>
            <Switch
              value={eliminationNotifsEnabled}
              onValueChange={handleEliminationNotifsToggle}
              accessibilityLabel="Notify when dose clears"
            />
          </View>
        </Card>

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
              <Typography variant="bodyLg" color="onPrimaryContainer">
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
            <Typography variant="bodyLg" color="onSurfaceVariant">
              You have access to all features.
            </Typography>
          </Card>
        )}

        {/* Legal */}
        <Pressable
          style={styles.legalBtn}
          onPress={() => router.push({ pathname: '/legal', params: { type: 'terms', from: 'settings' } })}
          accessibilityRole="button"
          accessibilityLabel="Terms of Service"
        >
          <Typography variant="bodyLg" color="onSurface">Terms of Service</Typography>
          <Typography variant="bodyLg" color="onSurfaceVariant">›</Typography>
        </Pressable>

        <Pressable
          style={styles.legalBtn}
          onPress={() => router.push({ pathname: '/legal', params: { type: 'privacy', from: 'settings' } })}
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
    paddingBottom: spacing[20],
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
    marginBottom: spacing[4],
  },
  toggleCard: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  toggleCardLast: {
    marginBottom: spacing[8],
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  toggleContent: {
    flex: 1,
    gap: spacing[1],
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
  disabled: {
    opacity: 0.5,
  },
});
