import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, SectionList, Pressable, ActivityIndicator, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography, Card } from '@/components/ui';
import { colors, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePillStore } from '@/stores/usePillStore';
import { fetchDoseHistory } from '@/services/supabase/pills';
import { captureException } from '@/services/sentry';
import type { Dose, Pill } from '@/core/types';

// Smooth dropdown expand/collapse on Android. iOS uses LayoutAnimation by default.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface MedicationGroup {
  pillId: string;
  drugName: string;
  color: string;
  doses: Dose[];
}

interface DayGroup {
  dateKey: string;
  label: string;
  pillsTaken: number;
  uniquePills: number;
  medications: MedicationGroup[];
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

function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Look up the pill's color from the current store. Soft-deleted pills are
 * filtered out of usePillStore, so missing-pill case falls back to the
 * primary accent — keeps history rendering correct after a pill is removed
 * from the stack.
 */
function lookupPillColor(pills: Pill[], pillId: string): string {
  return pills.find((p) => p.id === pillId)?.color ?? colors.primary;
}

function buildMedicationGroups(doses: Dose[], pills: Pill[]): MedicationGroup[] {
  const byPill = new Map<string, Dose[]>();
  for (const dose of doses) {
    const existing = byPill.get(dose.pillId) ?? [];
    existing.push(dose);
    byPill.set(dose.pillId, existing);
  }
  return Array.from(byPill.entries())
    .map(([pillId, ds]) => ({
      pillId,
      // drugName lives on the Dose itself (snapshot at record time), so it's
      // stable even if the pill row has since been deleted or renamed.
      drugName: ds[0].drugName,
      color: lookupPillColor(pills, pillId),
      doses: ds.sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime()),
    }))
    .sort((a, b) => a.drugName.localeCompare(b.drugName));
}

export default function HistoryScreen() {
  const user = useAuthStore((s) => s.user);
  const pills = usePillStore((s) => s.pills);
  const [allDoses, setAllDoses] = useState<Dose[]>([]);
  const [loading, setLoading] = useState(true);
  // Track which (dateKey, pillId) rows are expanded. A medication is
  // collapsible only when its dose count is >1; singletons render inline
  // and ignore this set.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
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
        const medications = buildMedicationGroups(doses, pills);
        return {
          dateKey,
          label: formatDayLabel(doses[0].takenAt),
          pillsTaken: doses.length,
          uniquePills: medications.length,
          medications,
        };
      });
  }, [allDoses, pills]);

  const sections = useMemo(
    () => dayGroups.map((g) => ({ title: g.label, dateKey: g.dateKey, data: [g] })),
    [dayGroups],
  );

  const toggleExpanded = useCallback((dateKey: string, pillId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => {
      const next = new Set(prev);
      const key = `${dateKey}:${pillId}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

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

            {item.medications.length > 0 && (
              <View style={styles.medList}>
                {item.medications.map((med) => {
                  const isSingle = med.doses.length === 1;
                  const isOpen = expanded.has(`${item.dateKey}:${med.pillId}`);
                  return (
                    <View key={med.pillId}>
                      <Pressable
                        onPress={() => !isSingle && toggleExpanded(item.dateKey, med.pillId)}
                        disabled={isSingle}
                        accessibilityRole={isSingle ? undefined : 'button'}
                        accessibilityState={isSingle ? undefined : { expanded: isOpen }}
                        accessibilityLabel={
                          isSingle
                            ? `${med.drugName} taken at ${formatTime(med.doses[0].takenAt)}`
                            : `${med.drugName}, ${med.doses.length} doses${isOpen ? ', expanded' : ', collapsed'}`
                        }
                        style={({ pressed }) => [
                          styles.medRow,
                          pressed && !isSingle && styles.medRowPressed,
                        ]}
                      >
                        <View style={[styles.medDot, { backgroundColor: med.color }]} />
                        <Typography variant="titleMd" style={styles.medName}>
                          {med.drugName}
                        </Typography>
                        <Typography variant="bodyLg" color="onSurfaceVariant">
                          {isSingle
                            ? formatTime(med.doses[0].takenAt)
                            : `${med.doses.length} doses`}
                        </Typography>
                        {!isSingle && (
                          <Typography
                            variant="bodyLg"
                            color="onSurfaceVariant"
                            style={styles.chevron}
                          >
                            {isOpen ? '▾' : '▸'}
                          </Typography>
                        )}
                      </Pressable>

                      {!isSingle && isOpen && (
                        <View style={styles.medDoseList}>
                          {med.doses.map((d) => (
                            <View key={d.id} style={styles.medDoseRow}>
                              <Typography variant="bodyMd" color="onSurfaceVariant">
                                Taken at {formatTime(d.takenAt)}
                              </Typography>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
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
    paddingBottom: spacing[20],
  },
  header: {
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
    gap: spacing[4],
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
    borderTopColor: colors.surfaceVariant + '4D',
  },
  stat: {
    gap: spacing[1],
  },
  medList: {
    gap: spacing[2],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.surfaceVariant + '4D',
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
  },
  medRowPressed: {
    opacity: 0.7,
  },
  medDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  medName: {
    flex: 1,
  },
  chevron: {
    marginLeft: spacing[2],
    minWidth: 16,
    textAlign: 'center',
  },
  medDoseList: {
    paddingLeft: spacing[6],
    paddingBottom: spacing[2],
    gap: spacing[1],
  },
  medDoseRow: {
    paddingVertical: spacing[1],
  },
  separator: {
    height: spacing[8],
  },
  sectionGap: {
    height: spacing[3],
  },
  empty: {
    paddingVertical: spacing[16],
    alignItems: 'center',
    gap: spacing[3],
  },
});
