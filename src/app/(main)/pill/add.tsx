import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Typography, Button, Input } from '@/components/ui';
import { colors, spacing, borderRadius, MIN_TOUCH_TARGET } from '@/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePillStore } from '@/stores/usePillStore';
import { PILL_COLORS } from '@/core/pillColors';
import type { PillType, ScheduleFrequency } from '@/core/types';

const FREQUENCY_OPTIONS: { label: string; value: ScheduleFrequency }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Specific days', value: 'specific_days' },
  { label: 'Every N days', value: 'every_n_days' },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AddPillScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const addPill = usePillStore((s) => s.addPill);

  // Form state
  const [drugName, setDrugName] = useState('');
  const [dosage, setDosage] = useState('');
  const [dosageUnit, setDosageUnit] = useState('mg');
  const [halfLife, setHalfLife] = useState('');
  const [halfLifeUnit, setHalfLifeUnit] = useState<'minutes' | 'hours'>('hours');
  const [pillType, setPillType] = useState<PillType>('scheduled');
  const [frequency, setFrequency] = useState<ScheduleFrequency>('daily');
  const [timeOfDay, setTimeOfDay] = useState('08:00');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [intervalDays, setIntervalDays] = useState('2');
  const [selectedColor, setSelectedColor] = useState<string>(PILL_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const halfLifeMinutes =
    halfLifeUnit === 'hours' ? parseFloat(halfLife || '0') * 60 : parseFloat(halfLife || '0');

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleSave = async () => {
    if (!user) return;
    if (!drugName.trim()) {
      Alert.alert('Missing name', 'Enter the drug name.');
      return;
    }
    if (halfLifeMinutes <= 0) {
      Alert.alert('Missing half-life', 'Enter the drug half-life.');
      return;
    }

    setSaving(true);
    try {
      const schedule =
        pillType === 'scheduled'
          ? {
              timeOfDay,
              frequency,
              ...(frequency === 'specific_days' ? { daysOfWeek } : {}),
              ...(frequency === 'every_n_days' ? { intervalDays: parseInt(intervalDays, 10) || 2 } : {}),
            }
          : null;

      await addPill(user.uid, {
        drugName: drugName.trim(),
        drugId: '',
        halfLifeMinutes,
        halfLifeSource: 'manual',
        dosageMg: parseFloat(dosage) || 0,
        dosageUnit,
        pillType,
        schedule,
        color: selectedColor,
        isActive: true,
      });

      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save pill.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Typography variant="titleMd" color="primary">Cancel</Typography>
          </Pressable>
          <Typography variant="headlineSm">Add Medication</Typography>
          <View style={{ width: 60 }} />
        </View>

        {/* Type toggle */}
        <View style={styles.typeRow}>
          <Pressable
            style={[styles.typeBtn, pillType === 'scheduled' && styles.typeBtnActive]}
            onPress={() => setPillType('scheduled')}
          >
            <Typography
              variant="labelLg"
              color={pillType === 'scheduled' ? 'onPrimary' : 'onSurfaceVariant'}
            >
              Scheduled
            </Typography>
          </Pressable>
          <Pressable
            style={[styles.typeBtn, pillType === 'random' && styles.typeBtnActive]}
            onPress={() => setPillType('random')}
          >
            <Typography
              variant="labelLg"
              color={pillType === 'random' ? 'onPrimary' : 'onSurfaceVariant'}
            >
              One-time
            </Typography>
          </Pressable>
        </View>

        {/* Drug name */}
        <Input
          label="Drug name"
          placeholder="e.g. Ibuprofen"
          value={drugName}
          onChangeText={setDrugName}
          autoCapitalize="words"
        />

        {/* Dosage */}
        <View style={styles.row}>
          <View style={{ flex: 2 }}>
            <Input
              label="Dosage"
              placeholder="200"
              value={dosage}
              onChangeText={setDosage}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Unit"
              placeholder="mg"
              value={dosageUnit}
              onChangeText={setDosageUnit}
            />
          </View>
        </View>

        {/* Half-life */}
        <View style={styles.row}>
          <View style={{ flex: 2 }}>
            <Input
              label="Half-life"
              placeholder={halfLifeUnit === 'hours' ? '2.5' : '150'}
              value={halfLife}
              onChangeText={setHalfLife}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.unitToggle}>
            <Pressable
              style={[styles.unitBtn, halfLifeUnit === 'hours' && styles.unitBtnActive]}
              onPress={() => setHalfLifeUnit('hours')}
            >
              <Typography
                variant="labelMd"
                color={halfLifeUnit === 'hours' ? 'onPrimary' : 'onSurfaceVariant'}
              >
                hrs
              </Typography>
            </Pressable>
            <Pressable
              style={[styles.unitBtn, halfLifeUnit === 'minutes' && styles.unitBtnActive]}
              onPress={() => setHalfLifeUnit('minutes')}
            >
              <Typography
                variant="labelMd"
                color={halfLifeUnit === 'minutes' ? 'onPrimary' : 'onSurfaceVariant'}
              >
                min
              </Typography>
            </Pressable>
          </View>
        </View>

        {/* Schedule (only for scheduled pills) */}
        {pillType === 'scheduled' && (
          <View style={styles.scheduleSection}>
            <Typography variant="titleMd" style={styles.sectionTitle}>Schedule</Typography>

            <Input
              label="Time of day"
              placeholder="08:00"
              value={timeOfDay}
              onChangeText={setTimeOfDay}
            />

            {/* Frequency */}
            <View style={styles.freqRow}>
              {FREQUENCY_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.freqBtn, frequency === opt.value && styles.freqBtnActive]}
                  onPress={() => setFrequency(opt.value)}
                >
                  <Typography
                    variant="labelMd"
                    color={frequency === opt.value ? 'onPrimary' : 'onSurfaceVariant'}
                  >
                    {opt.label}
                  </Typography>
                </Pressable>
              ))}
            </View>

            {/* Day picker */}
            {frequency === 'specific_days' && (
              <View style={styles.dayRow}>
                {DAY_LABELS.map((label, i) => (
                  <Pressable
                    key={i}
                    style={[styles.dayBtn, daysOfWeek.includes(i) && styles.dayBtnActive]}
                    onPress={() => toggleDay(i)}
                  >
                    <Typography
                      variant="labelSm"
                      color={daysOfWeek.includes(i) ? 'onPrimary' : 'onSurfaceVariant'}
                    >
                      {label}
                    </Typography>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Interval */}
            {frequency === 'every_n_days' && (
              <Input
                label="Every N days"
                placeholder="2"
                value={intervalDays}
                onChangeText={setIntervalDays}
                keyboardType="numeric"
              />
            )}
          </View>
        )}

        {/* Color picker */}
        <Typography variant="titleMd" style={styles.sectionTitle}>Color</Typography>
        <View style={styles.colorRow}>
          {PILL_COLORS.map((c) => (
            <Pressable
              key={c}
              style={[
                styles.colorDot,
                { backgroundColor: c },
                selectedColor === c && styles.colorDotSelected,
              ]}
              onPress={() => setSelectedColor(c)}
            />
          ))}
        </View>

        <Button
          title={pillType === 'scheduled' ? 'Add to Stack' : 'Start Tracking'}
          onPress={handleSave}
          loading={saving}
          style={styles.saveBtn}
        />
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
    padding: spacing[6],
    paddingBottom: spacing[24],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[6],
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[5],
  },
  typeBtn: {
    flex: 1,
    height: MIN_TOUCH_TARGET,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
  },
  typeBtnActive: {
    backgroundColor: colors.primary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  unitToggle: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing[1],
    alignItems: 'flex-end',
    paddingBottom: spacing[2],
  },
  unitBtn: {
    flex: 1,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
  },
  unitBtnActive: {
    backgroundColor: colors.primary,
  },
  scheduleSection: {
    marginTop: spacing[5],
    gap: spacing[3],
  },
  sectionTitle: {
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  freqRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  freqBtn: {
    flex: 1,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
  },
  freqBtnActive: {
    backgroundColor: colors.primary,
  },
  dayRow: {
    flexDirection: 'row',
    gap: spacing[1],
    justifyContent: 'space-between',
  },
  dayBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
  },
  dayBtnActive: {
    backgroundColor: colors.primary,
  },
  colorRow: {
    flexDirection: 'row',
    gap: spacing[3],
    flexWrap: 'wrap',
    marginBottom: spacing[6],
  },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: colors.onSurface,
  },
  saveBtn: {
    marginTop: spacing[4],
  },
});
