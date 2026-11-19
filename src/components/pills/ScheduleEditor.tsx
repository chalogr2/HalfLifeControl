import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Typography, Input } from '@/components/ui';
import { colors, spacing, borderRadius, MIN_TOUCH_TARGET } from '@/theme';
import {
  buildSchedule,
  nextScheduledDose,
  formatNextDose,
  type IntervalStart,
  type ScheduleDraft,
} from '@/core/scheduling';
import type { ScheduleFrequency } from '@/core/types';

/** 'as_needed' is an add-flow-only choice that turns the pill into a one-time (random) pill. */
export type EditorFrequency = ScheduleFrequency | 'as_needed';

export interface ScheduleEditorValue extends Omit<ScheduleDraft, 'frequency'> {
  frequency: EditorFrequency;
}

interface ScheduleEditorProps {
  value: ScheduleEditorValue;
  onChange: (next: ScheduleEditorValue) => void;
  /** Show the "As needed" option (add flow only). */
  allowAsNeeded?: boolean;
  /**
   * Existing every-N-days cycle anchor ("YYYY-MM-DD"). When set, a
   * "Keep current" start option is offered so editing the time or interval
   * doesn't silently shift the user's cycle.
   */
  keepStartDate?: string;
}

const FREQUENCY_OPTIONS: { label: string; value: EditorFrequency }[] = [
  { label: 'Every day', value: 'daily' },
  { label: 'Specific days', value: 'specific_days' },
  { label: 'Every N days', value: 'every_n_days' },
  { label: 'As needed', value: 'as_needed' },
];

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function ScheduleEditor({ value, onChange, allowAsNeeded = false, keepStartDate }: ScheduleEditorProps) {
  const options = allowAsNeeded
    ? FREQUENCY_OPTIONS
    : FREQUENCY_OPTIONS.filter((o) => o.value !== 'as_needed');

  const startOptions: { label: string; value: IntervalStart }[] = [
    ...(keepStartDate ? [{ label: 'Keep current', value: 'keep' as const }] : []),
    { label: 'Today', value: 'today' },
    { label: 'Tomorrow', value: 'tomorrow' },
  ];

  const set = (patch: Partial<ScheduleEditorValue>) => onChange({ ...value, ...patch });

  const toggleDay = (day: number) => {
    set({
      daysOfWeek: value.daysOfWeek.includes(day)
        ? value.daysOfWeek.filter((d) => d !== day)
        : [...value.daysOfWeek, day],
    });
  };

  // Live preview of what will be saved — catches "every 3 days, starting
  // today" at 3pm for an 8am dose resolving to three days from now.
  const preview = useMemo(() => {
    if (value.frequency === 'as_needed') return null;
    const now = new Date();
    const result = buildSchedule({ ...value, frequency: value.frequency }, now, keepStartDate);
    if (!result.ok) return null;
    return formatNextDose(nextScheduledDose(result.schedule, now), now);
  }, [value, keepStartDate]);

  return (
    <View>
      <Typography variant="bodyMd" color="onSurfaceVariant" style={styles.sub}>
        Frequency
      </Typography>
      <View style={styles.row}>
        {options.map((opt) => (
          <ChoiceButton
            key={opt.value}
            label={opt.label}
            selected={value.frequency === opt.value}
            onPress={() => set({ frequency: opt.value })}
          />
        ))}
      </View>

      {value.frequency === 'every_n_days' && (
        <>
          <Typography variant="bodyMd" color="onSurfaceVariant" style={styles.sub}>
            Take every
          </Typography>
          <View style={styles.inlineRow}>
            <View style={{ flex: 2 }}>
              <Input
                label=""
                placeholder="2"
                value={value.intervalDays}
                onChangeText={(t) => set({ intervalDays: t })}
                keyboardType="number-pad"
                accessibilityLabel="Days between doses"
              />
            </View>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Typography variant="bodyLg" color="onSurfaceVariant">days</Typography>
            </View>
          </View>

          <Typography variant="bodyMd" color="onSurfaceVariant" style={styles.sub}>
            First dose
          </Typography>
          <View style={styles.row}>
            {startOptions.map((opt) => (
              <ChoiceButton
                key={opt.value}
                label={opt.label}
                selected={value.intervalStart === opt.value}
                onPress={() => set({ intervalStart: opt.value })}
              />
            ))}
          </View>
        </>
      )}

      {value.frequency === 'specific_days' && (
        <>
          <Typography variant="bodyMd" color="onSurfaceVariant" style={styles.sub}>
            Select Days
          </Typography>
          <View style={styles.dayRow}>
            {DAY_LABELS.map((label, i) => {
              const checked = value.daysOfWeek.includes(i);
              return (
                <Pressable
                  key={i}
                  style={[styles.dayBtn, checked && styles.btnActive]}
                  onPress={() => toggleDay(i)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  accessibilityLabel={DAY_NAMES[i]}
                >
                  <Typography variant="labelMd" color={checked ? 'onPrimary' : 'onSurfaceVariant'}>
                    {label}
                  </Typography>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {value.frequency !== 'as_needed' && (
        <>
          <Typography variant="bodyMd" color="onSurfaceVariant" style={styles.sub}>
            Reminder Time (24-hour)
          </Typography>
          <Input
            label=""
            placeholder="08:00"
            value={value.timeOfDay}
            onChangeText={(t) => set({ timeOfDay: t })}
            keyboardType="numbers-and-punctuation"
            accessibilityLabel="Reminder time, 24-hour format"
          />
          {preview && (
            <Typography variant="bodyMd" color="primary" style={styles.preview}>
              Next dose: {preview}
            </Typography>
          )}
        </>
      )}
    </View>
  );
}

function ChoiceButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.choiceBtn, selected && styles.btnActive]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Typography variant="labelMd" color={selected ? 'onPrimary' : 'onSurfaceVariant'} align="center">
        {label}
      </Typography>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sub: {
    marginBottom: spacing[3],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  inlineRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  choiceBtn: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing[1],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
  },
  btnActive: {
    backgroundColor: colors.primary,
  },
  dayRow: {
    flexDirection: 'row',
    gap: spacing[2],
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  dayBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
  },
  preview: {
    marginTop: -spacing[1],
    marginBottom: spacing[2],
  },
});
