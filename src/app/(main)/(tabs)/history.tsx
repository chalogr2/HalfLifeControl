import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, SectionList, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Typography, Card } from '@/components/ui';
import { colors, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import { fetchDoseHistory } from '@/services/supabase/pills';
import { captureException } from '@/services/sentry';
import type { Dose } from '@/core/types';

interface DayGroup {
  dateKey: string;
  label: string;
  doses: Dose[];
  pillsTaken: number;
  uniquePills: number;
}

function formatDayLabel(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isToday(dateKey: string): boolean {
  return dateKey === getDateKey(new Date());
}

export default function HistoryScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [allDoses, setAllDoses] = useState<Dose[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Fetch last 3 months of history (3 reads max)
        const doses = await fetchDoseHistory(user.uid, 3);
        if (!cancelled) setAllDoses(doses);
      } catch (err) {
        captureException(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.uid]);

  const dayGroups = useMemo<DayGroup[]>(() => {
    const groups = new Map<string, Dose[]>();
    for (const dose of allDoses) {
      const key = getDateKey(dose.takenAt);
      const existing = groups.get(key) ?? [];
      existing.push(dose);
      groups.set(key, existing);
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, doses]) => {
        const uniquePills = new Set(doses.map((d) => d.pillId)).size;
        return {
          dateKey,
          label: formatDayLabel(doses[0].takenAt),
          doses,
          pillsTaken: doses.length,
          uniquePills,
        };
      });
  }, [allDoses]);

  // Adherence = days with at least 1 dose / total days in date range
  const adherencePercent = useMemo(() => {
    if (dayGroups.length === 0) return 0;
    // Calculate the actual date range span (first dose to today)
    const sortedKeys = dayGroups.map((g) => g.dateKey).sort();
    const earliest = sortedKeys[0];
    const [y, m, d] = earliest.split('-').map(Number);
    const startDate = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalDays = Math.max(
      1,
      Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    );
    const daysWithDoses = dayGroups.length;
    return Math.round((daysWithDoses / totalDays) * 100);
  }, [dayGroups]);

  const sections = useMemo(
    () => dayGroups.map((g) => ({ title: g.label, dateKey: g.dateKey, data: [g] })),
    [dayGroups],
  );

  const handleDayPress = useCallback(
    (dateKey: string) => {
      router.push(`/(main)/history/${dateKey}`);
    },
    [router],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.dateKey}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Typography variant="headlineLg" color="primary">History</Typography>

            {/* Adherence summary */}
            {dayGroups.length > 0 && (
              <View style={styles.adherenceCard}>
                <Typography variant="bodyMd" color="onSurfaceVariant">
                  OVERALL ADHERENCE
                </Typography>
                <View style={styles.adherenceRow}>
                  <Typography variant="displayMd" color="primary">
                    {adherencePercent}%
                  </Typography>
                  <Typography variant="bodyMd" color="onSurfaceVariant" style={styles.adherenceLabel}>
                    {'\n'}Based on your {dayGroups.length} tracked day{dayGroups.length !== 1 ? 's' : ''}.{'\n'}
                    You're doing great!
                  </Typography>
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Typography variant="headlineSm" align="center" color="onSurfaceVariant">
              No history yet
            </Typography>
            <Typography variant="bodyLg" align="center" color="outline">
              Your dose history will appear here once you start tracking.
            </Typography>
          </View>
        }
        renderSectionHeader={() => null}
        renderSectionFooter={() => <View style={styles.sectionGap} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleDayPress(item.dateKey)}
            style={({ pressed }) => pressed && styles.pressed}
            accessibilityRole="button"
            accessibilityLabel={`${isToday(item.dateKey) ? 'Today' : item.label}, ${item.pillsTaken} pills taken, ${item.uniquePills} medications`}
            accessibilityHint="View day detail"
          >
            <Card variant="scheduled" style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <Typography variant="headlineSm">
                  {isToday(item.dateKey) ? 'Today' : item.label}
                </Typography>
              </View>
              <View style={styles.dayStats}>
                <View style={styles.stat}>
                  <Typography variant="headlineSm" color="primary">
                    {item.pillsTaken}
                  </Typography>
                  <Typography variant="bodyLg" color="onSurfaceVariant">
                    pills taken
                  </Typography>
                </View>
                <View style={styles.stat}>
                  <Typography variant="headlineSm" color="secondary">
                    {item.uniquePills}
                  </Typography>
                  <Typography variant="bodyLg" color="onSurfaceVariant">
                    medications
                  </Typography>
                </View>
              </View>
            </Card>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing[6],
    paddingBottom: 120,
  },
  header: {
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
    gap: spacing[4],
  },
  adherenceCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius['2xl'],
    padding: spacing[6],
    gap: spacing[2],
  },
  adherenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  adherenceLabel: {
    flex: 1,
  },
  dayCard: {
    gap: spacing[4],
    padding: spacing[6],
    borderRadius: borderRadius['2xl'],
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayStats: {
    flexDirection: 'row',
    gap: spacing[8],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.surfaceVariant + '4D', // ~30% opacity
  },
  stat: {
    gap: spacing[1],
  },
  separator: {
    height: spacing[8],
  },
  sectionGap: {
    height: spacing[3], // 12px — matches dashboard item separator
  },
  empty: {
    paddingVertical: spacing[16],
    alignItems: 'center',
    gap: spacing[3],
  },
  pressed: {
    opacity: 0.85,
  },
});
