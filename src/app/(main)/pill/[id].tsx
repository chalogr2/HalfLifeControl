import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { Typography, Button, ScreenHeader } from '@/components/ui';
import { ScheduleEditor, type ScheduleEditorValue } from '@/components/pills';
import { useCountdown } from '@/hooks/useCountdown';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePillStore } from '@/stores/usePillStore';
import { describeSchedule, buildSchedule, sameSchedule, toLocalDateKey } from '@/core/scheduling';
import { latestActiveDose } from '@/core/doses';
import { parsePositiveNumber } from '@/core/numbers';
import { timerDurationMinutes, formatTimeRemaining, timerMinutesRemaining } from '@/core/halflife';
import { colors, spacing, borderRadius, MIN_TOUCH_TARGET } from '@/theme';
import type { TimerType, Dose, DurationType, Pill } from '@/core/types';

interface TimerConfig {
  type: TimerType;
  label: string;
  sublabel: string;
}

/**
 * Build the list of timer rings shown on the detail screen.
 * - Category C (durationType === 'none') hides the first row entirely.
 * - Category A labels the first row "Duration of Action".
 * - Category B labels it "Dosing Interval" (or "Maintenance Interval" for methotrexate-style weekly drugs).
 */
function getTimerConfigs(
  durationType: DurationType,
  isMaintenanceInterval: boolean,
): TimerConfig[] {
  const configs: TimerConfig[] = [];
  if (durationType === 'action') {
    configs.push({ type: 'action', label: 'Duration of Action', sublabel: 'LEFT' });
  } else if (durationType === 'interval') {
    configs.push({
      type: 'action',
      label: isMaintenanceInterval ? 'Maintenance Interval' : 'Dosing Interval',
      sublabel: 'LEFT',
    });
  }
  configs.push({ type: 'halfLife', label: 'Half-Life', sublabel: 'LEFT' });
  configs.push({ type: 'clearance', label: 'Clearance Time', sublabel: 'LEFT' });
  return configs;
}

function DetailTimerRing({
  takenAt,
  halfLifeMinutes,
  durationOfActionMinutes,
  timerType,
  isSelected,
  onPress,
  pillColor,
  config,
}: {
  takenAt: Date;
  halfLifeMinutes: number;
  durationOfActionMinutes: number | null;
  timerType: TimerType;
  isSelected: boolean;
  onPress: () => void;
  pillColor: string;
  config: TimerConfig;
}) {
  const { timeLabel, progress, minutesRemaining } = useCountdown(takenAt, halfLifeMinutes, timerType, durationOfActionMinutes);
  const isDone = minutesRemaining <= 0;

  const size = 112;
  const strokeWidth = isSelected ? 10 : 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const remaining = 1 - Math.min(1, Math.max(0, progress));
  const strokeDashoffset = circumference * (1 - remaining);
  const ringColor = isDone
    ? colors.outlineVariant
    : isSelected
    ? colors.secondary
    : colors.primaryContainer;

  return (
    <Pressable
      style={[
        styles.timerButton,
        isSelected && !isDone && styles.timerButtonSelected,
        isDone && styles.timerButtonDone,
      ]}
      onPress={isDone ? undefined : onPress}
      disabled={isDone}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDone, selected: isSelected && !isDone }}
      accessibilityLabel={`${config.label}, ${isDone ? 'complete, unavailable' : timeLabel + ' remaining'}${isSelected && !isDone ? ', selected as dashboard timer' : ''}`}
      accessibilityHint={isDone ? undefined : 'Tap to set as your dashboard timer'}
    >
      {isSelected && !isDone && (
        <View style={styles.checkBadge}>
          <Ionicons name="checkmark" size={16} color="#fff" />
        </View>
      )}
      <View style={[styles.ringContainer, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke={colors.surfaceContainerHigh}
            strokeWidth={strokeWidth} fill="none"
          />
          <Circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke={ringColor}
            strokeWidth={strokeWidth} fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={styles.ringLabel}>
          <Typography
            variant="titleMd"
            color={isDone ? 'outline' : isSelected ? 'secondary' : 'primary'}
            align="center"
          >
            {isDone ? 'Done' : timeLabel}
          </Typography>
          {!isDone && (
            <Typography
              variant="labelSm"
              color={isSelected ? 'secondary' : 'primary'}
              align="center"
              style={styles.sublabel}
            >
              {config.sublabel}
            </Typography>
          )}
        </View>
      </View>
      <Typography
        variant="labelLg"
        color={isDone ? 'outline' : isSelected ? 'primary' : 'onSurface'}
        style={styles.timerLabel}
      >
        {config.label}
      </Typography>
    </Pressable>
  );
}

function InactiveTimerRing({
  halfLifeMinutes,
  durationOfActionMinutes,
  timerType,
  isSelected,
  onPress,
  config,
}: {
  halfLifeMinutes: number;
  durationOfActionMinutes: number | null;
  timerType: TimerType;
  isSelected: boolean;
  onPress: () => void;
  config: TimerConfig;
}) {
  const totalMinutes = timerDurationMinutes(halfLifeMinutes, timerType, durationOfActionMinutes);
  const totalLabel = formatTimeRemaining(totalMinutes);

  const size = 112;
  const strokeWidth = isSelected ? 10 : 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const ringColor = isSelected ? colors.secondary : colors.primaryContainer;

  return (
    <Pressable
      style={[styles.timerButton, isSelected && styles.timerButtonSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${config.label}, ${totalLabel} total${isSelected ? ', selected' : ''}`}
      accessibilityHint="Tap to set as your dashboard timer"
    >
      {isSelected && (
        <View style={styles.checkBadge}>
          <Ionicons name="checkmark" size={16} color="#fff" />
        </View>
      )}
      <View style={[styles.ringContainer, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke={colors.surfaceContainerHigh}
            strokeWidth={strokeWidth} fill="none"
          />
          <Circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke={ringColor}
            strokeWidth={strokeWidth} fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={0}
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={styles.ringLabel}>
          <Typography
            variant="titleMd"
            color={isSelected ? 'secondary' : 'primary'}
            align="center"
          >
            {totalLabel}
          </Typography>
          <Typography
            variant="labelSm"
            color={isSelected ? 'secondary' : 'primary'}
            align="center"
            style={styles.sublabel}
          >
            TOTAL
          </Typography>
        </View>
      </View>
      <Typography
        variant="labelLg"
        color={isSelected ? 'primary' : 'onSurface'}
        style={styles.timerLabel}
      >
        {config.label}
      </Typography>
    </Pressable>
  );
}

/**
 * The cycle anchor of an existing every-N-days schedule: its stored
 * startDate, or (legacy rows saved before startDate existed) the pill's
 * createdAt day — the same fallback the scheduler itself uses.
 */
function intervalKeepStartDate(pill: Pill): string | undefined {
  const s = pill.schedule;
  if (!s || s.frequency !== 'every_n_days') return undefined;
  return s.startDate ?? toLocalDateKey(pill.createdAt);
}

export default function PillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { pills, activeDoses, updatePill, deletePill, recordDose, setPillPreferredTimerLocal } = usePillStore();

  const pill = useMemo(() => pills.find((p) => p.id === id), [pills, id]);
  const activeDose: Dose | undefined = useMemo(() => {
    if (!pill) return undefined;
    return latestActiveDose(activeDoses, pill.id);
  }, [activeDoses, pill]);

  const [editingDosage, setEditingDosage] = useState(false);
  const [dosageText, setDosageText] = useState('');
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleEditorValue | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Timer selection is local-only while the screen is open, and persists exactly
  // once on unmount if the value changed. This avoids racing concurrent Firestore
  // transactions (which would hit failed-precondition errors and, via the store
  // echo, snap the UI back to stale values mid-tap).
  const [selectedTimer, setSelectedTimer] = useState<TimerType | undefined>(pill?.preferredTimer);
  const initialTimerRef = useRef<TimerType | undefined>(pill?.preferredTimer);
  // Tracks what should be persisted — the user's LAST EXPLICIT pick. Auto-switch
  // (when the selected timer finishes) moves `selectedTimer` for visual purposes
  // but leaves this untouched, so a transient rollover doesn't become permanent.
  const persistTimerRef = useRef<TimerType | undefined>(pill?.preferredTimer);
  const latestRef = useRef<{
    userId: string | undefined;
    pillId: string | undefined;
    wasDeleted: boolean;
  }>({
    userId: user?.uid,
    pillId: pill?.id,
    wasDeleted: false,
  });
  latestRef.current.userId = user?.uid;
  latestRef.current.pillId = pill?.id;

  // Capture the baseline once the pill data is actually loaded (cold cache case).
  useEffect(() => {
    if (pill?.preferredTimer && initialTimerRef.current === undefined) {
      initialTimerRef.current = pill.preferredTimer;
      persistTimerRef.current = pill.preferredTimer;
      setSelectedTimer(pill.preferredTimer);
    }
  }, [pill?.preferredTimer]);

  // Persist the selection once, on unmount, if it changed and the pill wasn't deleted.
  useEffect(() => {
    return () => {
      const { userId, pillId, wasDeleted } = latestRef.current;
      const current = persistTimerRef.current;
      if (wasDeleted) return;
      if (!userId || !pillId || !current) return;
      if (current === initialTimerRef.current) return;
      // Fire-and-forget — screen is already gone, nothing to revert.
      updatePill(userId, pillId, { preferredTimer: current }).catch(() => {});
    };
    // Mount-only: cleanup runs on unmount and reads from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const timerConfigs = useMemo(
    () =>
      getTimerConfigs(
        pill?.durationType ?? 'action',
        pill?.isMaintenanceInterval ?? false,
      ),
    [pill?.durationType, pill?.isMaintenanceInterval],
  );

  // If the persisted preferredTimer points to a timer we no longer show
  // (e.g. 'action' on a Category C pill), fall back to 'clearance'.
  useEffect(() => {
    if (!selectedTimer) return;
    if (!timerConfigs.some((c) => c.type === selectedTimer)) {
      setSelectedTimer('clearance');
      persistTimerRef.current = 'clearance';
    }
  }, [timerConfigs, selectedTimer]);

  // Tick every second while a dose is active so `doneMap` and the auto-switch
  // effect below stay in sync with the individual timer rings (which also tick
  // internally via useCountdown). One setInterval for the whole screen is fine.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!activeDose) return;
    const id = setInterval(() => forceTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [activeDose?.id]);

  // Which timers have hit zero for the current active dose. Recomputed on every
  // render (which `forceTick` drives during an active dose).
  const doneMap = useMemo<Record<TimerType, boolean>>(() => {
    const map: Record<TimerType, boolean> = { action: false, halfLife: false, clearance: false };
    if (!activeDose) return map;
    const now = new Date();
    for (const cfg of timerConfigs) {
      const rem = timerMinutesRemaining(
        activeDose.takenAt,
        activeDose.halfLifeMinutes,
        cfg.type,
        now,
        activeDose.durationOfActionMinutes,
      );
      map[cfg.type] = rem <= 0;
    }
    return map;
    // forceTick is deliberately excluded: the tick state-update causes a re-render,
    // which rebuilds this memo via its `activeDose` dep proxy (new `now` each time).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDose, timerConfigs]);

  // Visual auto-switch: if the user's selected timer finishes, display the next
  // still-active one closest to zero. Does NOT touch `persistTimerRef` or the
  // store — we keep the user's explicit choice intact; the dashboard applies
  // the same rollover logic via `pickEffectiveTimer` on its own.
  useEffect(() => {
    if (!activeDose || !selectedTimer) return;
    if (!doneMap[selectedTimer]) return;
    const now = new Date();
    const candidates = timerConfigs
      .filter((c) => !doneMap[c.type])
      .map((c) => ({
        type: c.type,
        rem: timerMinutesRemaining(
          activeDose.takenAt,
          activeDose.halfLifeMinutes,
          c.type,
          now,
          activeDose.durationOfActionMinutes,
        ),
      }));
    if (candidates.length === 0) return;
    candidates.sort((a, b) => a.rem - b.rem);
    setSelectedTimer(candidates[0].type);
  }, [doneMap, selectedTimer, activeDose, timerConfigs]);

  if (!pill) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Typography variant="bodyLg" color="onSurfaceVariant">Pill not found</Typography>
        </View>
      </SafeAreaView>
    );
  }

  const handleSelectTimer = (timerType: TimerType) => {
    if (selectedTimer === timerType) return;
    // Guard against picking a finished timer (shouldn't be reachable since done
    // rings have onPress cleared, but belt-and-suspenders).
    if (doneMap[timerType]) return;
    // Update local UI state (this screen) AND the Zustand store so the dashboard
    // already reflects the new timer the moment the user returns. The actual
    // Firestore/cache write happens once, on unmount, to avoid per-tap spam.
    setSelectedTimer(timerType);
    persistTimerRef.current = timerType;
    setPillPreferredTimerLocal(pill.id, timerType);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Pill',
      `Remove ${pill.drugName} from your ${pill.pillType === 'scheduled' ? 'stack' : 'one-time tracking'}? Your dose history will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            // Prevent the unmount effect from writing preferredTimer to a deleted pill.
            latestRef.current.wasDeleted = true;
            await deletePill(user.uid, pill.id);
            router.back();
          },
        },
      ],
    );
  };

  const handleTakeDose = async () => {
    if (!user || activeDose) return;
    try {
      await recordDose(user.uid, pill, new Date(), 'manual');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to record dose.');
    }
  };

  const handleSaveDosage = async () => {
    const newDosage = parsePositiveNumber(dosageText);
    if (!user || newDosage === null) {
      setEditingDosage(false);
      return;
    }
    await updatePill(user.uid, pill.id, { dosageMg: newDosage });
    setEditingDosage(false);
  };

  const startEditDosage = () => {
    setDosageText(String(pill.dosageMg));
    setEditingDosage(true);
  };

  // Existing every-N-days cycle anchor, offered as "Keep current" so changing
  // the time or interval doesn't silently shift which days the user takes it.
  const keepStartDate = intervalKeepStartDate(pill);

  const startEditSchedule = () => {
    const s = pill.schedule;
    if (!s) return;
    setScheduleDraft({
      frequency: s.frequency,
      timeOfDay: s.timeOfDay,
      daysOfWeek: s.daysOfWeek ?? [],
      intervalDays: String(s.intervalDays ?? 2),
      intervalStart: keepStartDate ? 'keep' : 'today',
    });
  };

  const handleSaveSchedule = async () => {
    if (!user || !scheduleDraft || !pill.schedule) return;
    // The editor never offers 'as_needed' here (that would turn the pill into
    // a one-time pill with a different lifecycle), so frequency is a real one.
    if (scheduleDraft.frequency === 'as_needed') return;

    const built = buildSchedule({ ...scheduleDraft, frequency: scheduleDraft.frequency }, new Date(), keepStartDate);
    if (!built.ok) {
      Alert.alert(built.title, built.message);
      return;
    }
    if (sameSchedule(built.schedule, pill.schedule)) {
      setScheduleDraft(null);
      return;
    }

    setSavingSchedule(true);
    try {
      // Reminders re-schedule automatically: the dashboard's effect re-runs
      // scheduleAllPillReminders whenever the pill list changes.
      await updatePill(user.uid, pill.id, { schedule: built.schedule });
      setScheduleDraft(null);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update schedule.');
    } finally {
      setSavingSchedule(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Medication" variant="close" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Pill name + subtitle */}
        <View style={styles.titleSection}>
          <Typography variant="headlineLg" color="primary" align="center">
            {pill.drugName} {pill.dosageMg}{pill.dosageUnit}
          </Typography>
          {pill.schedule && (
            <Typography variant="bodyLg" color="onSurfaceVariant" align="center">
              {describeSchedule(pill.schedule)}
            </Typography>
          )}
        </View>

        {/* Safety banner: weekly-dosed drugs (e.g. methotrexate) */}
        {pill.requiresWeeklyWarning && (
          <View style={styles.weeklyWarning}>
            <Ionicons name="warning" size={20} color={colors.error} />
            <View style={{ flex: 1 }}>
              <Typography variant="labelLg" color="error">
                Dosed once per week
              </Typography>
              <Typography variant="bodySm" color="onSurface">
                Taking this drug daily can be fatal. The timer shows your 7-day
                interval between doses.
              </Typography>
            </View>
          </View>
        )}

        {/* Take dose button (only when no active dose) */}
        {!activeDose && (
          <Pressable
            style={[styles.takeDoseButton, { backgroundColor: pill.color }]}
            onPress={handleTakeDose}
            accessibilityRole="button"
            accessibilityLabel={`Record taking ${pill.drugName}`}
          >
            <Ionicons name="play" size={20} color="#fff" />
            <Typography variant="labelLg" style={{ color: '#fff' }}>
              Take Dose
            </Typography>
          </Pressable>
        )}

        {/* Timer selection */}
        <View style={styles.timerSection}>
          <Typography variant="titleLg" color="onSurface">
            Timer Display Selection
          </Typography>
          <Typography variant="bodyMd" color="onSurfaceVariant" style={styles.timerHint}>
            Tap a timer to set as your dashboard default
          </Typography>
          <View style={styles.timerGrid}>
            {timerConfigs.map((config) =>
              activeDose ? (
                <DetailTimerRing
                  key={config.type}
                  takenAt={activeDose.takenAt}
                  halfLifeMinutes={activeDose.halfLifeMinutes}
                  durationOfActionMinutes={activeDose.durationOfActionMinutes}
                  timerType={config.type}
                  isSelected={selectedTimer === config.type}
                  onPress={() => handleSelectTimer(config.type)}
                  pillColor={pill.color}
                  config={config}
                />
              ) : (
                <InactiveTimerRing
                  key={config.type}
                  halfLifeMinutes={pill.halfLifeMinutes}
                  durationOfActionMinutes={pill.durationOfActionMinutes}
                  timerType={config.type}
                  isSelected={selectedTimer === config.type}
                  onPress={() => handleSelectTimer(config.type)}
                  config={config}
                />
              ),
            )}
          </View>
        </View>

        {/* Edit dosage — locked while the pill has an active dose to avoid
            shifting historical math mid-countdown. */}
        <View style={[styles.dosageSection, !!activeDose && styles.dosageSectionDisabled]}>
          <Typography variant="titleLg" color={activeDose ? 'onSurfaceVariant' : 'onSurface'}>
            Edit Dosage
          </Typography>
          {activeDose && (
            <Typography variant="bodySm" color="onSurfaceVariant" style={styles.dosageLockedHint}>
              Locked while a timer is active.
            </Typography>
          )}
          <Pressable
            style={[styles.dosageRow, !!activeDose && styles.dosageRowDisabled]}
            onPress={activeDose ? undefined : startEditDosage}
            disabled={!!activeDose}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!activeDose }}
            accessibilityLabel={
              activeDose
                ? `Dosage ${pill.dosageMg} ${pill.dosageUnit}. Locked while a timer is active.`
                : `Current dosage: ${pill.dosageMg} ${pill.dosageUnit}. Tap to edit.`
            }
          >
            {editingDosage && !activeDose ? (
              <TextInput
                style={styles.dosageInput}
                value={dosageText}
                onChangeText={setDosageText}
                keyboardType="decimal-pad"
                autoFocus
                onBlur={handleSaveDosage}
                onSubmitEditing={handleSaveDosage}
                selectTextOnFocus
              />
            ) : (
              <View style={styles.dosageDisplay}>
                <Typography
                  variant="displaySm"
                  color={activeDose ? 'onSurfaceVariant' : 'primary'}
                  align="center"
                >
                  {pill.dosageMg}
                </Typography>
              </View>
            )}
            <Typography variant="titleLg" color="onSurfaceVariant">
              {pill.dosageUnit}
            </Typography>
          </Pressable>
        </View>

        {/* Schedule — stack (scheduled) pills only */}
        {pill.schedule && (
          <View style={styles.dosageSection}>
            <Typography variant="titleLg" color="onSurface">
              Schedule
            </Typography>
            <Typography variant="bodyLg" color="onSurfaceVariant" style={styles.scheduleSummary}>
              {describeSchedule(pill.schedule)}
            </Typography>
            <Pressable
              style={({ pressed }) => [styles.editScheduleButton, pressed && styles.editScheduleButtonPressed]}
              onPress={startEditSchedule}
              accessibilityRole="button"
              accessibilityLabel={`Edit schedule. Currently ${describeSchedule(pill.schedule)}`}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              <Typography variant="titleMd" color="primary">
                Edit Schedule
              </Typography>
            </Pressable>
          </View>
        )}

        {/* Delete pill */}
        <Pressable
          style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
          onPress={handleDelete}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${pill.drugName}`}
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
          <Typography variant="titleMd" color="error">
            Delete Pill
          </Typography>
        </Pressable>
      </ScrollView>

      {/* Edit schedule sheet */}
      <Modal
        visible={scheduleDraft !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setScheduleDraft(null)}
      >
        <KeyboardAvoidingView
          style={styles.sheetOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Typography variant="headlineSm" color="primary" style={styles.sheetTitle}>
                Edit Schedule
              </Typography>
              {scheduleDraft && (
                <ScheduleEditor
                  value={scheduleDraft}
                  onChange={setScheduleDraft}
                  keepStartDate={keepStartDate}
                />
              )}
              <View style={styles.sheetActions}>
                <Button title="Save Schedule" onPress={handleSaveSchedule} loading={savingSchedule} />
                <Pressable
                  style={styles.sheetCancel}
                  onPress={() => setScheduleDraft(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel editing schedule"
                >
                  <Typography variant="bodyLg" color="primary">Cancel</Typography>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    height: 56,
  },
  closeButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: MIN_TOUCH_TARGET / 2,
  },
  headerTitle: {
    fontWeight: '900',
  },
  headerSpacer: {
    width: MIN_TOUCH_TARGET,
  },
  content: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[8],
  },
  titleSection: {
    paddingVertical: spacing[6],
    alignItems: 'center',
    gap: spacing[2],
  },
  takeDoseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    height: 48,
    borderRadius: borderRadius.xl,
    marginBottom: spacing[6],
  },
  timerSection: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.xl,
    padding: spacing[6],
    marginBottom: spacing[6],
  },
  timerHint: {
    marginTop: spacing[1],
    marginBottom: spacing[6],
  },
  timerGrid: {
    gap: spacing[5],
  },
  timerButton: {
    alignItems: 'center',
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
  },
  timerButtonSelected: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  timerButtonDone: {
    opacity: 0.45,
  },
  checkBadge: {
    position: 'absolute',
    top: -6,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  ringLabel: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sublabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  timerLabel: {
    fontWeight: '600',
  },
  dosageSection: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: spacing[6],
    borderLeftWidth: 6,
    borderLeftColor: colors.primary,
    marginBottom: spacing[6],
  },
  dosageSectionDisabled: {
    borderLeftColor: colors.outlineVariant,
  },
  dosageLockedHint: {
    marginTop: spacing[1],
  },
  dosageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
    backgroundColor: colors.surfaceContainerHigh,
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    marginTop: spacing[4],
  },
  dosageRowDisabled: {
    opacity: 0.5,
  },
  dosageDisplay: {
    width: 120,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  dosageInput: {
    width: 120,
    height: 72,
    textAlign: 'center',
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    height: 56,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.error,
    marginBottom: spacing[8],
  },
  scheduleSummary: {
    marginTop: spacing[1],
  },
  editScheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    minHeight: MIN_TOUCH_TARGET,
    marginTop: spacing[4],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceContainerHigh,
  },
  editScheduleButtonPressed: {
    opacity: 0.7,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[8],
  },
  sheetTitle: {
    marginBottom: spacing[4],
  },
  sheetActions: {
    marginTop: spacing[4],
    gap: spacing[2],
  },
  sheetCancel: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonPressed: {
    backgroundColor: colors.errorContainer + '33',
  },
  weeklyWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    marginBottom: spacing[5],
    backgroundColor: colors.errorContainer,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.error,
  },
});
