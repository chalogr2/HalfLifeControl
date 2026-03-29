import React, { useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Typography } from '@/components/ui';
import { PillCard } from '@/components/pills';
import { colors, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePillStore } from '@/stores/usePillStore';
import { nextScheduledDose } from '@/core/scheduling';
import type { Pill, Dose } from '@/core/types';

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

  const scheduledPills = useMemo(() => pills.filter((p) => p.pillType === 'scheduled'), [pills]);
  const randomPills = useMemo(() => pills.filter((p) => p.pillType === 'random'), [pills]);

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
    return `Next: ${h12}:${String(m).padStart(2, '0')} ${ampm}`;
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
      if (dose) {
        // Already active — could navigate to detail later
        return;
      }
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
    <SafeAreaView style={styles.container}>
      <FlatList
        data={[...scheduledPills, ...randomPills]}
        keyExtractor={(item) => item.id}
        renderItem={renderPill}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Typography variant="headlineMd">
                {user?.displayName ? `Hi, ${user.displayName}` : 'Dashboard'}
              </Typography>
            </View>

            {/* Scheduled section header */}
            {scheduledPills.length > 0 && (
              <Typography variant="titleMd" color="onSurfaceVariant" style={styles.sectionTitle}>
                My Daily Stack
              </Typography>
            )}
          </>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Typography variant="headlineSm" align="center" color="onSurfaceVariant">
                No medications yet
              </Typography>
              <Typography variant="bodyLg" align="center" color="outline" style={styles.emptySubtext}>
                Tap the + button below to add your first medication.
              </Typography>
            </View>
          ) : null
        }
      />

      {/* Floating Action Button */}
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
  list: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[24],
  },
  header: {
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
  },
  sectionTitle: {
    marginBottom: spacing[3],
  },
  separator: {
    height: spacing[3],
  },
  empty: {
    paddingVertical: spacing[16],
    alignItems: 'center',
    gap: spacing[3],
  },
  emptySubtext: {
    maxWidth: 260,
  },
  fab: {
    position: 'absolute',
    bottom: spacing[8],
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
