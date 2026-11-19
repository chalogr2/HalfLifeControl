import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Typography, Button, Input, ScreenHeader } from '@/components/ui';
import { DrugSearchBar, ScheduleEditor, type SearchResult, type ScheduleEditorValue } from '@/components/pills';
import { colors, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePillStore } from '@/stores/usePillStore';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { completeOnboarding } from '@/services/supabase/auth';
import { PILL_COLORS } from '@/core/pillColors';
import { buildSchedule } from '@/core/scheduling';
import { parsePositiveNumber } from '@/core/numbers';
import type { PillType, DurationType, PillSchedule } from '@/core/types';

export default function AddPillScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const user = useAuthStore((s) => s.user);
  const addPill = usePillStore((s) => s.addPill);
  const pills = usePillStore((s) => s.pills);
  const activeDoses = usePillStore((s) => s.activeDoses);
  const canAddScheduledPill = useSubscriptionStore((s) => s.canAddScheduledPill);
  const canAddRandomPill = useSubscriptionStore((s) => s.canAddRandomPill);
  const scheduledCount = pills.filter((p) => p.pillType === 'scheduled').length;
  // Random slots are freed when the countdown completes (drug eliminated)
  const now = Date.now();
  const randomCount = pills.filter((p) => {
    if (p.pillType !== 'random' || !p.isActive) return false;
    return activeDoses.some(
      (d) => d.pillId === p.id && d.status === 'active' && d.eliminationAt.getTime() > now,
    );
  }).length;

  // Form state
  const [drugName, setDrugName] = useState('');
  const [dosage, setDosage] = useState('');
  const [dosageUnit, setDosageUnit] = useState('mg');
  const [halfLife, setHalfLife] = useState('');
  const [halfLifeUnit, setHalfLifeUnit] = useState<'minutes' | 'hours'>('hours');
  const [halfLifeSource, setHalfLifeSource] = useState<'curated' | 'manual'>('manual');
  // Snapshotted from curated DB at pick time. null = no curated value → fall back to 2× half-life multiplier.
  const [durationOfActionMinutes, setDurationOfActionMinutes] = useState<number | null>(null);
  const [durationType, setDurationType] = useState<DurationType>('action');
  const [isMaintenanceInterval, setIsMaintenanceInterval] = useState<boolean>(false);
  const [requiresWeeklyWarning, setRequiresWeeklyWarning] = useState<boolean>(false);
  const [pillType, setPillType] = useState<PillType>(
    params.type === 'random' ? 'random' : 'scheduled',
  );
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleEditorValue>({
    frequency: 'daily',
    timeOfDay: '08:00',
    daysOfWeek: [],
    intervalDays: '2',
    intervalStart: 'today',
  });
  const frequency = scheduleDraft.frequency;
  const [selectedColor, setSelectedColor] = useState<string>(PILL_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [savedPillName, setSavedPillName] = useState('');
  const [errors, setErrors] = useState<{ name?: string; halfLife?: string; dosage?: string }>({});

  // parsePositiveNumber accepts "2,5" (Android keyboards in comma-decimal
  // locales) — parseFloat read that as 2 and "0,5" as 0, which tripped the
  // "Missing half-life" check even though the field was filled in.
  const halfLifeValue = parsePositiveNumber(halfLife);
  const halfLifeMinutes =
    halfLifeValue === null ? null : halfLifeUnit === 'hours' ? halfLifeValue * 60 : halfLifeValue;

  // Typing in the search box (without tapping a suggestion) still names the
  // pill. Editing the name after picking a curated drug turns it into a
  // custom entry: the curated timing no longer applies, but the half-life
  // stays pre-filled so the user can keep or change it.
  const handleQueryChange = useCallback((text: string) => {
    setDrugName(text);
    setErrors((e) => ({ ...e, name: undefined }));
    setHalfLifeSource((src) => {
      if (src === 'curated') {
        setDurationOfActionMinutes(null);
        setDurationType('action');
        setIsMaintenanceInterval(false);
        setRequiresWeeklyWarning(false);
      }
      return 'manual';
    });
  }, []);

  const handleDrugSelect = useCallback((result: SearchResult) => {
    setDrugName(result.name);
    setErrors({});
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
      setDurationOfActionMinutes(result.drug.durationOfActionMinutes);
      setDurationType(result.drug.durationType ?? 'action');
      setIsMaintenanceInterval(result.drug.isMaintenanceInterval ?? false);
      setRequiresWeeklyWarning(result.drug.requiresWeeklyWarning ?? false);
    } else {
      setHalfLifeSource('manual');
      setDurationOfActionMinutes(null);
      setDurationType('action');
      setIsMaintenanceInterval(false);
      setRequiresWeeklyWarning(false);
    }
  }, []);

  // Section badges are numbered from what's actually on screen: the
  // half-life step only appears for custom drugs and the schedule step only
  // for stack pills, so fixed numbers left gaps ("2, HL, 4").
  const showHalfLife = halfLifeSource === 'manual';
  const showSchedule = pillType !== 'random';
  const stepHalfLife = 2;
  const stepSchedule = showHalfLife ? 3 : 2;
  const stepColor = 2 + (showHalfLife ? 1 : 0) + (showSchedule ? 1 : 0);

  const effectivePillType: PillType = pillType === 'random' ? 'random' : (frequency === 'as_needed' ? 'random' : 'scheduled');

  const handleSave = async () => {
    if (!user) return;
    const nextErrors: typeof errors = {};
    if (!drugName.trim()) nextErrors.name = 'Enter the drug name.';
    if (halfLifeMinutes === null) {
      nextErrors.halfLife = halfLife.trim()
        ? 'Use a number greater than 0, e.g. 2.5'
        : 'Enter the drug half-life.';
    }
    // Required: the database rejects dosage_mg <= 0 (pills_dosage_mg_check),
    // and FDA search results carry no default dose to pre-fill.
    const dosageValue = parsePositiveNumber(dosage);
    if (dosageValue === null) {
      nextErrors.dosage = dosage.trim() ? 'Use a number greater than 0, e.g. 200' : 'Enter the dose you take.';
    }
    setErrors(nextErrors);
    if (
      nextErrors.name ||
      nextErrors.halfLife ||
      nextErrors.dosage ||
      halfLifeMinutes === null ||
      dosageValue === null
    ) {
      Alert.alert(
        'Check the form',
        nextErrors.name ?? nextErrors.halfLife ?? nextErrors.dosage ?? 'Some fields need attention.',
      );
      return;
    }

    // Validation (time format, at least one weekday, sane interval) lives in
    // core/scheduling so the edit-schedule flow enforces the exact same rules.
    const isScheduled = effectivePillType === 'scheduled';
    let schedule: PillSchedule | null = null;
    if (isScheduled && frequency !== 'as_needed') {
      const built = buildSchedule({ ...scheduleDraft, frequency });
      if (!built.ok) {
        Alert.alert(built.title, built.message);
        return;
      }
      schedule = built.schedule;
    }

    // Free tier gate: check limits by pill type
    if (isScheduled && !canAddScheduledPill(scheduledCount)) {
      router.navigate('/(main)/(tabs)/paywall');
      return;
    }
    if (!isScheduled && !canAddRandomPill(randomCount)) {
      router.navigate('/(main)/(tabs)/paywall');
      return;
    }

    setSaving(true);
    try {
      await addPill(user.uid, {
        drugName: drugName.trim(),
        drugId: '',
        halfLifeMinutes,
        halfLifeSource,
        durationOfActionMinutes,
        durationType,
        isMaintenanceInterval,
        requiresWeeklyWarning,
        dosageMg: dosageValue,
        dosageUnit,
        pillType: effectivePillType,
        schedule,
        color: selectedColor,
        preferredTimer: 'clearance',
        isActive: true,
      });

      // Mark onboarding complete after first pill added
      if (user && !user.onboardingComplete) {
        await completeOnboarding(user.uid);
        useAuthStore.getState().setUser({ ...user, onboardingComplete: true });
      }

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
    // After onboarding, the AuthGate will redirect to dashboard
    // when onboardingComplete becomes true. For normal add-pill, go back.
    if (user?.onboardingComplete) {
      router.back();
    } else {
      router.replace('/(main)/(tabs)/dashboard');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Add Medication" variant="close" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Title */}
        <Typography variant="headlineMd" color="primary" style={styles.title}>
          Which pill are you adding?
        </Typography>
        <Typography variant="bodyMd" color="onSurfaceVariant" style={styles.titleSub}>
          Search our database or type a custom name.
        </Typography>

        {/* Drug Search */}
        <DrugSearchBar
          onSelect={handleDrugSelect}
          onQueryChange={handleQueryChange}
          error={errors.name}
        />

        {/* Dosage section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Typography variant="labelMd" color="onPrimary">1</Typography>
            </View>
            <Typography variant="titleMd" color="primary">Dosage</Typography>
          </View>
          <Typography variant="bodyMd" color="onSurfaceVariant" style={styles.sectionSub}>
            How much do you take?
          </Typography>
          <View style={styles.row}>
            <View style={{ flex: 2 }}>
              <Input
                label=""
                placeholder="e.g. 20"
                value={dosage}
                onChangeText={(t) => {
                  setDosage(t);
                  setErrors((e) => ({ ...e, dosage: undefined }));
                }}
                keyboardType="decimal-pad"
                error={errors.dosage}
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
        {showHalfLife && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Typography variant="labelMd" color="onPrimary">{stepHalfLife}</Typography>
              </View>
              <Typography variant="titleMd" color="primary">Half-Life</Typography>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 2 }}>
                <Input
                  label=""
                  placeholder={halfLifeUnit === 'hours' ? '2.5' : '150'}
                  value={halfLife}
                  onChangeText={(t) => {
                    setHalfLife(t);
                    setErrors((e) => ({ ...e, halfLife: undefined }));
                  }}
                  keyboardType="decimal-pad"
                  error={errors.halfLife}
                />
              </View>
              <View style={styles.unitToggle}>
                <Pressable
                  style={[styles.unitBtn, halfLifeUnit === 'hours' && styles.unitBtnActive]}
                  onPress={() => setHalfLifeUnit('hours')}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: halfLifeUnit === 'hours' }}
                  accessibilityLabel="Hours"
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
                  accessibilityRole="radio"
                  accessibilityState={{ selected: halfLifeUnit === 'minutes' }}
                  accessibilityLabel="Minutes"
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

        {/* Schedule section — only for stack (scheduled) pills */}
        {showSchedule && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Typography variant="labelMd" color="onPrimary">{stepSchedule}</Typography>
              </View>
              <Typography variant="titleMd" color="primary">Schedule</Typography>
            </View>

            <ScheduleEditor value={scheduleDraft} onChange={setScheduleDraft} allowAsNeeded />
          </View>
        )}

        {/* Pill Color */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Typography variant="labelMd" color="onPrimary">{stepColor}</Typography>
            </View>
            <Typography variant="titleMd" color="primary">Pill Color</Typography>
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
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedColor === c }}
                accessibilityLabel={`Pill color ${c}`}
              />
            ))}
          </View>
        </View>

        {/* Spacer: must clear the fixed bottom CTA (padding 24 + button 64 + paddingBottom 40 = 128px, plus buffer) */}
        <View style={{ height: 148 }} />
      </ScrollView>

      {/* Fixed bottom CTA */}
      <View style={styles.bottomCTA}>
        <Button
          title={effectivePillType === 'scheduled' ? 'Add to My Stack' : 'Add Pill'}
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
