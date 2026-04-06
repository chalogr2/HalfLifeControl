import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Typography, Card } from '@/components/ui';
import { ProgressRing } from '@/components/pills';
import { colors, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import { fetchDosesByDateRange } from '@/services/supabase/pills';
import { usePillStore } from '@/stores/usePillStore';
import type { Dose } from '@/core/types';

function formatDayTitle(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${d}`;
}

function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function getTimeOfDayLabel(hour: number): string {
  if (hour < 12) return 'Morning Medications';
  if (hour < 17) return 'Afternoon Medications';
  return 'Evening Medications';
}

interface TimeGroup {
  label: string;
  doses: Dose[];
}

export default function DayDetailScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();
  const user = useAuthStore((s) => s.user);
  const pills = usePillStore((s) => s.pills);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !date) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [y, m, d] = date.split('-').map(Number);
        const startOfDay = new Date(y, m - 1, d, 0, 0, 0, 0);
        const endOfDay = new Date(y, m - 1, d, 23, 59, 59, 999);
        const result = await fetchDosesByDateRange(user.uid, startOfDay, endOfDay);
        if (!cancelled) setDoses(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.uid, date]);

  // Group by time of day
  const timeGroups = useMemo<TimeGroup[]>(() => {
    const groups = new Map<string, Dose[]>();
    for (const dose of doses) {
      const label = getTimeOfDayLabel(dose.takenAt.getHours());
      const existing = groups.get(label) ?? [];
      existing.push(dose);
      groups.set(label, existing);
    }
    return Array.from(groups.entries()).map(([label, d]) => ({ label, doses: d }));
  }, [doses]);

  // Completion: scheduled pills due this day / taken this day
  const actualDayOfWeek = date ? (() => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d).getDay();
  })() : new Date().getDay();

  const scheduledPillsDueToday = pills.filter((p) => {
    if (p.pillType !== 'scheduled' || !p.schedule) return false;
    if (p.schedule.frequency === 'daily') return true;
    if (p.schedule.frequency === 'specific_days') {
      return p.schedule.daysOfWeek?.includes(actualDayOfWeek) ?? false;
    }
    return false;
  });
  const scheduledTaken = new Set(
    doses
      .filter((d) => scheduledPillsDueToday.some((p) => p.id === d.pillId))
      .map((d) => d.pillId),
  ).size;
  const completionPct = scheduledPillsDueToday.length > 0
    ? Math.round((scheduledTaken / scheduledPillsDueToday.length) * 100)
    : doses.length > 0 ? 100 : 0;

  const getPillColor = (pillId: string): string => {
    return pills.find((p) => p.id === pillId)?.color ?? colors.primary;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Typography variant="bodyLg" color="primary">Back</Typography>
          </Pressable>
          <Typography variant="headlineMd">{date ? formatDayTitle(date) : 'Day Detail'}</Typography>
          <View style={{ width: 40 }} />
        </View>

        {/* Completion ring */}
        <View style={styles.completionCard}>
          <View>
            <Typography variant="labelLg" color="onSurfaceVariant">Daily Completion</Typography>
            <Typography variant="displaySm" color="primary">{completionPct}%</Typography>
          </View>
          <ProgressRing
            progress={1 - completionPct / 100}
            label={`${scheduledTaken}/${scheduledPillsDueToday.length || doses.length}`}
            size={80}
            strokeWidth={8}
            color={colors.primary}
          />
        </View>

        {/* Time-of-day groups */}
        {timeGroups.map((group) => (
          <View key={group.label} style={styles.timeGroup}>
            <Typography variant="labelLg" color="onSurfaceVariant" style={styles.timeGroupLabel}>
              {group.label.toUpperCase()}
            </Typography>
            {group.doses.map((dose) => (
              <Card key={dose.id} variant="elevated" style={styles.doseCard}>
                <View style={styles.doseRow}>
                  <View style={[styles.doseDot, { backgroundColor: getPillColor(dose.pillId) }]} />
                  <View style={styles.doseInfo}>
                    <Typography variant="titleMd">{dose.drugName}</Typography>
                    <Typography variant="bodyMd" color="onSurfaceVariant">
                      Taken at {formatTime(dose.takenAt)}
                    </Typography>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        ))}

        {doses.length === 0 && (
          <View style={styles.empty}>
            <Typography variant="bodyLg" color="onSurfaceVariant" align="center">
              No doses recorded on this day.
            </Typography>
          </View>
        )}

        {/* Consistency badge */}
        {completionPct === 100 && doses.length > 0 && (
          <View style={styles.badge}>
            <Typography variant="titleMd" color="secondary" align="center">
              Great Consistency!
            </Typography>
            <Typography variant="bodyMd" color="onSurfaceVariant" align="center">
              You have followed your medication plan perfectly for this day.
            </Typography>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  loader: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[24],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[4],
  },
  completionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.xl,
    padding: spacing[5],
    marginBottom: spacing[6],
  },
  timeGroup: {
    marginBottom: spacing[5],
    gap: spacing[3],
  },
  timeGroupLabel: {
    marginBottom: spacing[1],
  },
  doseCard: {
    paddingVertical: spacing[3],
  },
  doseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  doseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  doseInfo: {
    flex: 1,
    gap: 2,
  },
  empty: {
    paddingVertical: spacing[10],
  },
  badge: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: borderRadius.xl,
    padding: spacing[5],
    gap: spacing[2],
    marginTop: spacing[4],
  },
});
