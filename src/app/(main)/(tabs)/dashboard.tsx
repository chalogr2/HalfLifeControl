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
  const { pills, activeDoses, isLoading, recordDose } = usePillStore();

  // Schedule notifications when pills change
  useEffect(() => {
    if (pills.length > 0) {
      scheduleAllPillReminders(pills);
    }
  }, [pills]);

  // Handle notification taps — record dose for the tapped pill
  useEffect(() => {
    const cleanup = setNotificationResponseHandler((pillId) => {
      const pill = pills.find((p) => p.id === pillId);
      if (pill && user) {
        handleTakePill(pill);
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
    const s: Section[] = [];
    if (scheduledPills.length > 0) s.push({ title: 'My Daily Stack', data: scheduledPills });
    // Always show the random section so users can add one-time pills
    s.push({ title: 'One-Time Tracking', data: randomPills });
    return s;
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
        <Typography variant="headlineMd">My Daily Stack</Typography>
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

      {pills.length === 0 && !isLoading ? (
        <View style={styles.empty}>
          <Typography variant="headlineSm" align="center" color="onSurfaceVariant">
            No medications yet
          </Typography>
          <Typography variant="bodyLg" align="center" color="outline" style={styles.emptySubtext}>
            Tap the + button to add your first medication.
          </Typography>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderPill}
          renderSectionHeader={({ section }) => (
            <Typography variant="titleMd" color="onSurfaceVariant" style={styles.sectionHeader}>
              {section.title}
            </Typography>
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
      )}
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
    paddingBottom: spacing[4],
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
    paddingBottom: spacing[24],
  },
  sectionHeader: {
    marginTop: spacing[5],
    marginBottom: spacing[3],
  },
  separator: {
    height: spacing[3],
  },
  addToStack: {
    alignItems: 'center',
    paddingVertical: spacing[4],
    marginTop: spacing[2],
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.outlineVariant,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    gap: spacing[3],
  },
  emptySubtext: {
    maxWidth: 260,
  },
});
