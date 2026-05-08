import React, { useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, SectionList, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Typography } from '@/components/ui';
import { PillCard } from '@/components/pills';
import { colors, spacing, borderRadius, MIN_TOUCH_TARGET } from '@/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePillStore } from '@/stores/usePillStore';
import { nextScheduledDose } from '@/core/scheduling';
import { scheduleAllPillReminders, setNotificationResponseHandler } from '@/services/notifications';
import type { Pill, Dose } from '@/core/types';

interface Section {
  title: string;
  data: Pill[];
}

export default function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { pills, activeDoses, recordDose, pruneExpiredDoses, hardDeletePill } = usePillStore();

  // Schedule notifications when pills or relevant settings change. Always
  // run (not gated on pills.length > 0) so removing the last pill also
  // cleans up its pending reminder, and toggling reminderMode to 'off'
  // immediately tears down what's queued.
  useEffect(() => {
    scheduleAllPillReminders(pills, {
      reminderMode: user?.settings?.reminderMode ?? 'prompt',
      notificationsEnabled: user?.settings?.notificationsEnabled ?? true,
    });
  }, [pills, user?.settings?.reminderMode, user?.settings?.notificationsEnabled]);

  // Real-time pruning: when an active dose's eliminationAt passes, drop it from
  // the store immediately so random-tracking pills disappear without requiring
  // a tap. One-shot setTimeouts per active dose — far cheaper than a poll loop,
  // and guarantees the exact moment of expiry triggers a re-render.
  //
  // For one-time-tracking pills (`pillType === 'random'`) the lifecycle ends at
  // dose elimination, so we also hard-delete the pill row + its doses here.
  // Scheduled pills keep their soft state — only the active dose is cleared.
  useEffect(() => {
    if (activeDoses.length === 0) return;
    const now = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const d of activeDoses) {
      const delay = d.eliminationAt.getTime() - now;
      const onExpire = () => {
        pruneExpiredDoses();
        const pill = pills.find((p) => p.id === d.pillId);
        if (pill?.pillType === 'random' && user) {
          hardDeletePill(user.uid, pill.id).catch(() => {});
        }
      };
      if (delay <= 0) {
        timers.push(setTimeout(onExpire, 0));
      } else if (delay < 24 * 60 * 60 * 1000) {
        // Only schedule timers up to 24h out; a re-render will cover longer horizons.
        timers.push(setTimeout(onExpire, delay + 250));
      }
    }
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [activeDoses, pills, user, pruneExpiredDoses, hardDeletePill]);

  // Cold-start + foreground sweeps for orphaned one-time tracking pills now
  // live in `usePillStore.cleanupOrphanedRandomPills`, kicked off from
  // `init` (cold start) and from the AppState listener in the root layout.
  // Keeping the logic at the data layer means it runs even when the user
  // resumes onto a screen that isn't the dashboard.

  // Handle notification taps. "Took it" action records doses for every pill
  // in the (possibly grouped) reminder. Default tap also records — the
  // notification is itself the prompt; tapping it is acknowledgement.
  // Snooze is handled internally by the notifications service and does not
  // bubble up here.
  useEffect(() => {
    const cleanup = setNotificationResponseHandler((pillIds) => {
      if (!user || pillIds.length === 0) return;
      for (const id of pillIds) {
        const pill = pills.find((p) => p.id === id);
        if (pill) handleTakePill(pill);
      }
    });
    return cleanup;
  }, [pills, user]);

  const scheduledPills = useMemo(() => pills.filter((p) => p.pillType === 'scheduled'), [pills]);
  // Random pills auto-archive: only show if they have a non-eliminated active dose
  const randomPills = useMemo(() => {
    const now = Date.now();
    return pills.filter((p) => {
      if (p.pillType !== 'random') return false;
      const dose = activeDoses.find((d) => d.pillId === p.id);
      // Show if there's an active countdown, or if the pill was just added (no dose yet)
      return !dose || dose.eliminationAt.getTime() > now;
    });
  }, [pills, activeDoses]);

  const sections = useMemo<Section[]>(() => {
    return [
      { title: 'My Daily Stack', data: scheduledPills },
      { title: 'One-Time Tracking', data: randomPills },
    ];
  }, [scheduledPills, randomPills]);

  const getActiveDose = useCallback(
    (pillId: string): Dose | undefined => {
      const dose = activeDoses.find((d) => d.pillId === pillId);
      if (!dose) return undefined;
      // Skip eliminated doses — allows re-tracking random pills
      if (dose.eliminationAt.getTime() <= Date.now()) return undefined;
      return dose;
    },
    [activeDoses],
  );

  const getNextDoseLabel = useCallback((pill: Pill): string | undefined => {
    if (!pill.schedule) return undefined;
    const next = nextScheduledDose(pill.schedule);
    const h = next.getHours();
    const m = next.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `Next dose: ${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }, []);

  const handleTakePill = useCallback(
    async (pill: Pill) => {
      if (!user) return;
      try {
        await recordDose(user.uid, pill, new Date(), 'manual');
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to record dose.');
      }
    },
    [user, recordDose],
  );

  const handlePillPress = useCallback(
    (pill: Pill) => {
      router.push(`/(main)/pill/${pill.id}`);
    },
    [router],
  );

  const renderPill = useCallback(
    ({ item }: { item: Pill }) => (
      <PillCard
        pill={item}
        activeDose={getActiveDose(item.id)}
        nextDoseLabel={getNextDoseLabel(item)}
        onPress={() => handlePillPress(item)}
        onTakeDose={() => handleTakePill(item)}
      />
    ),
    [getActiveDose, getNextDoseLabel, handlePillPress, handleTakePill],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Typography variant="headlineLg" color="primary">Dashboard</Typography>
        <Pressable
          style={styles.avatar}
          accessibilityRole="button"
          accessibilityLabel="User profile"
        >
          <Typography variant="labelLg" color="onPrimary">
            {user?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'}
          </Typography>
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderPill}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Typography variant="titleLg" color="primary">
              {section.title}
            </Typography>
            <View style={styles.sectionHeaderLine} />
          </View>
        )}
        renderSectionFooter={({ section }) =>
          section.title === 'My Daily Stack' ? (
            <Pressable
              style={styles.addToStack}
              onPress={() => router.push('/(main)/pill/add?type=scheduled')}
              accessibilityRole="button"
              accessibilityLabel="Add pill to stack"
            >
              <Typography variant="labelLg" color="primary">
                + Add pill to stack
              </Typography>
            </Pressable>
          ) : section.title === 'One-Time Tracking' ? (
            <Pressable
              style={styles.addToStack}
              onPress={() => router.push('/(main)/pill/add?type=random')}
              accessibilityRole="button"
              accessibilityLabel="Track another pill"
            >
              <Typography variant="labelLg" color="primary">
                + Track another pill
              </Typography>
            </Pressable>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[2],
    paddingBottom: 0,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[20],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[6],
    marginBottom: spacing[6],
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: colors.surfaceContainerHigh,
  },
  separator: {
    height: spacing[4],
  },
  addToStack: {
    alignItems: 'center',
    paddingVertical: spacing[4],
    marginTop: spacing[4],
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.outlineVariant,
  },
});
