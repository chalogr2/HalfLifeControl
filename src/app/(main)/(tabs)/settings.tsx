import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography, Card } from '@/components/ui';
import { colors, spacing, borderRadius, MIN_TOUCH_TARGET } from '@/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import { signOut } from '@/services/firebase/auth';

type ReminderMode = 'auto_start' | 'prompt' | 'simple';

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
  const user = useAuthStore((s) => s.user);
  // For now, store reminder mode locally. Will persist to Firestore later.
  const [reminderMode, setReminderMode] = React.useState<ReminderMode>('auto_start');

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
              onPress={() => setReminderMode(opt.value)}
              style={({ pressed }) => pressed && styles.pressed}
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

        {/* Legal */}
        <Pressable style={styles.legalBtn}>
          <Typography variant="bodyLg" color="onSurface">Terms of Service</Typography>
          <Typography variant="bodyLg" color="onSurfaceVariant">›</Typography>
        </Pressable>

        <Pressable style={styles.legalBtn}>
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
        <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
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
