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
  const { pills, activeDoses, isLoading, subscribe, unsubscribe, recordDose } = usePillStore();

  useEffect(() => {
    if (user?.uid) {
      subscribe(user.uid);
      return () => unsubscribe();
    }
  }, [user?.uid]);

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
  const randomPills = useMemo(() => pills.filter((p) => p.pillType === 'random'), [pills]);

  const sections = useMemo<Section[]>(() => {
    const s: Section[] = [];
    if (scheduledPills.length > 0) s.push({ title: 'My Daily Stack', data: scheduledPills });
    if (randomPills.length > 0) s.push({ title: 'One-Time Tracking', data: randomPills });
    return s;
  }, [scheduledPills, randomPills]);

  const getActiveDose = useCallback(
    (pillId: string): Dose | undefined => activeDoses.find((d) => d.pillId === pillId),
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
      const dose = getActiveDose(pill.id);
      if (dose) return; // Already tracking

      Alert.alert(
        pill.drugName,
        'Record that you just took this?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Took it', onPress: () => handleTakePill(pill) },
        ],
      );
    },
    [getActiveDose, handleTakePill],
  );

  const renderPill = useCallback(
    ({ item }: { item: Pill }) => (
      <PillCard
        pill={item}
        activeDose={getActiveDose(item.id)}
        nextDoseLabel={getNextDoseLabel(item)}
        onPress={() => handlePillPress(item)}
      />
    ),
    [getActiveDose, getNextDoseLabel, handlePillPress],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Typography variant="headlineMd">My Daily Stack</Typography>
        <Pressable style={styles.avatar}>
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
              >
                <Typography variant="labelLg" color="primary">
                  + Add pill to stack
                </Typography>
              </Pressable>
            ) : section.title === 'One-Time Tracking' ? (
              <Pressable
                style={styles.addToStack}
                onPress={() => router.push('/(main)/pill/add?type=random')}
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

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => router.push('/(main)/pill/add')}
        accessibilityLabel="Add medication"
        accessibilityRole="button"
      >
        <Typography variant="displaySm" color="onPrimary" style={styles.fabIcon}>
          +
        </Typography>
      </Pressable>
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
  fab: {
    position: 'absolute',
    bottom: spacing[3],
    right: spacing[6],
    width: 64,
    height: 64,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabPressed: {
    opacity: 0.85,
  },
  fabIcon: {
    marginTop: -2,
  },
});
