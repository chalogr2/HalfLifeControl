import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Typography, Button, Input } from '@/components/ui';
import { DrugSearchBar, type SearchResult } from '@/components/pills';
import { colors, spacing, borderRadius, MIN_TOUCH_TARGET } from '@/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePillStore } from '@/stores/usePillStore';
import { PILL_COLORS } from '@/core/pillColors';
import type { PillType, ScheduleFrequency } from '@/core/types';

const FREQUENCY_OPTIONS: { label: string; value: ScheduleFrequency | 'as_needed' }[] = [
  { label: 'Every day', value: 'daily' },
  { label: 'Specific days', value: 'specific_days' },
  { label: 'As needed', value: 'as_needed' },
];

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function AddPillScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const user = useAuthStore((s) => s.user);
  const addPill = usePillStore((s) => s.addPill);

  // Form state
  const [drugName, setDrugName] = useState('');
  const [dosage, setDosage] = useState('');
  const [dosageUnit, setDosageUnit] = useState('mg');
  const [halfLife, setHalfLife] = useState('');
  const [halfLifeUnit, setHalfLifeUnit] = useState<'minutes' | 'hours'>('hours');
  const [halfLifeSource, setHalfLifeSource] = useState<'curated' | 'manual'>('manual');
  const [pillType, setPillType] = useState<PillType>(
    params.type === 'random' ? 'random' : 'scheduled',
  );
  const [frequency, setFrequency] = useState<ScheduleFrequency | 'as_needed'>('daily');
  const [timeOfDay, setTimeOfDay] = useState('08:00');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [selectedColor, setSelectedColor] = useState<string>(PILL_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [savedPillName, setSavedPillName] = useState('');

  const halfLifeMinutes =
    halfLifeUnit === 'hours' ? parseFloat(halfLife || '0') * 60 : parseFloat(halfLife || '0');

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleDrugSelect = useCallback((result: SearchResult) => {
    setDrugName(result.name);
    if (result.drug) {
      // Curated — auto-fill half-life and dosage
      const hl = result.drug.halfLifeMinutes;
      if (hl >= 60) {
        setHalfLife(String(Math.round(hl / 60 * 10) / 10));
        setHalfLifeUnit('hours');
      } else {
        setHalfLife(String(hl));
        setHalfLifeUnit('minutes');
      }
      setDosage(String(result.drug.commonDosageMg));
      setHalfLifeSource('curated');
    } else {
      setHalfLifeSource('manual');
    }
  }, []);

  const effectivePillType: PillType = frequency === 'as_needed' ? 'random' : pillType;

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
      const isScheduled = effectivePillType === 'scheduled';
      const schedule = isScheduled
        ? {
            timeOfDay,
            frequency: frequency as ScheduleFrequency,
            ...(frequency === 'specific_days' ? { daysOfWeek } : {}),
          }
        : null;

      await addPill(user.uid, {
        drugName: drugName.trim(),
        drugId: '',
        halfLifeMinutes,
        halfLifeSource,
        dosageMg: parseFloat(dosage) || 0,
        dosageUnit,
        pillType: effectivePillType,
        schedule,
        color: selectedColor,
        isActive: true,
      });

      setSavedPillName(drugName.trim());
      setShowSuccess(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save pill.');
    } finally {
      setSaving(false);
    }
  };

  const handleSuccessDismiss = () => {
    setShowSuccess(false);
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Typography variant="bodyLg" color="primary">Cancel</Typography>
          </Pressable>
          <Typography variant="titleLg">Refined Add Medication V2</Typography>
          <View style={{ width: 50 }} />
        </View>

        {/* Title */}
        <Typography variant="headlineMd" style={styles.title}>
          Which pill are you adding?
        </Typography>
        <Typography variant="bodyMd" color="onSurfaceVariant" style={styles.titleSub}>
          Search our database or type a custom name.
        </Typography>

        {/* Drug Search */}
        <DrugSearchBar onSelect={handleDrugSelect} />

        {/* Dosage section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Typography variant="labelMd" color="onPrimary">2</Typography>
            </View>
            <Typography variant="titleMd">Dosage</Typography>
          </View>
          <Typography variant="bodyMd" color="onSurfaceVariant" style={styles.sectionSub}>
            How much do you take?
          </Typography>
          <View style={styles.row}>
            <View style={{ flex: 2 }}>
              <Input
                label=""
                placeholder="85"
                value={dosage}
                onChangeText={setDosage}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label=""
                placeholder="mg"
                value={dosageUnit}
                onChangeText={setDosageUnit}
              />
            </View>
          </View>
        </View>

        {/* Half-life (only if manual) */}
        {halfLifeSource === 'manual' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Typography variant="labelMd" color="onPrimary">HL</Typography>
              </View>
              <Typography variant="titleMd">Half-Life</Typography>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 2 }}>
                <Input
                  label=""
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
          </View>
        )}

        {/* Schedule section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Typography variant="labelMd" color="onPrimary">3</Typography>
            </View>
            <Typography variant="titleMd">Schedule</Typography>
          </View>

          {/* Frequency toggles */}
          <Typography variant="bodyMd" color="onSurfaceVariant" style={styles.sectionSub}>
            Frequency
          </Typography>
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

          {/* Day picker for specific days */}
          {frequency === 'specific_days' && (
            <>
              <Typography variant="bodyMd" color="onSurfaceVariant" style={styles.sectionSub}>
                Select Days
              </Typography>
              <View style={styles.dayRow}>
                {DAY_LABELS.map((label, i) => (
                  <Pressable
                    key={i}
                    style={[styles.dayBtn, daysOfWeek.includes(i) && styles.dayBtnActive]}
                    onPress={() => toggleDay(i)}
                  >
                    <Typography
                      variant="labelMd"
                      color={daysOfWeek.includes(i) ? 'onPrimary' : 'onSurfaceVariant'}
                    >
                      {label}
                    </Typography>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* Reminder time */}
          {frequency !== 'as_needed' && (
            <>
              <Typography variant="bodyMd" color="onSurfaceVariant" style={styles.sectionSub}>
                Reminder Time
              </Typography>
              <Input
                label=""
                placeholder="08:00"
                value={timeOfDay}
                onChangeText={setTimeOfDay}
              />
            </>
          )}
        </View>

        {/* Pill Color */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Typography variant="labelMd" color="onPrimary">4</Typography>
            </View>
            <Typography variant="titleMd">Pill Color</Typography>
          </View>
          <Typography variant="bodyMd" color="onSurfaceVariant" style={styles.sectionSub}>
            Visual Identity
          </Typography>
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
        </View>

        {/* Spacer for FAB */}
        <View style={{ height: spacing[24] }} />
      </ScrollView>

      {/* Fixed bottom CTA */}
      <View style={styles.bottomCTA}>
        <Button
          title={effectivePillType === 'scheduled' ? 'Add to My Stack' : 'Start Tracking'}
          onPress={handleSave}
          loading={saving}
        />
      </View>

      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.successIcon}>
              <Typography variant="displaySm" align="center">✓</Typography>
            </View>
            <Typography variant="headlineSm" align="center">
              Medication Added!
            </Typography>
            <Typography variant="bodyMd" color="onSurfaceVariant" align="center" style={styles.successSub}>
              {savedPillName} has been added to your{' '}
              {effectivePillType === 'scheduled' ? 'daily stack' : 'tracking'}.
            </Typography>
            <Button title="Back to Dashboard" onPress={handleSuccessDismiss} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  title: {
    marginBottom: spacing[1],
  },
  titleSub: {
    marginBottom: spacing[5],
  },
  section: {
    marginTop: spacing[6],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionSub: {
    marginBottom: spacing[3],
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
  freqRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  freqBtn: {
    flex: 1,
    height: MIN_TOUCH_TARGET,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
  },
  freqBtnActive: {
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
  dayBtnActive: {
    backgroundColor: colors.primary,
  },
  colorRow: {
    flexDirection: 'row',
    gap: spacing[3],
    flexWrap: 'wrap',
  },
  colorDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: colors.onSurface,
  },
  bottomCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing[6],
    paddingBottom: spacing[10],
    backgroundColor: colors.surface,
  },
  // Success modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing[8],
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: spacing[4],
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successSub: {
    maxWidth: 260,
  },
});
