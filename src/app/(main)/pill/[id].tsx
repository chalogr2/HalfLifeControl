import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { Typography } from '@/components/ui';
import { useCountdown } from '@/hooks/useCountdown';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePillStore } from '@/stores/usePillStore';
import { describeSchedule } from '@/core/scheduling';
import { timerDurationMinutes, formatTimeRemaining, timerMinutesRemaining, timerProgress } from '@/core/halflife';
import { colors, spacing, borderRadius, MIN_TOUCH_TARGET } from '@/theme';
import type { TimerType, Dose } from '@/core/types';

const TIMER_CONFIGS: { type: TimerType; label: string; sublabel: string }[] = [
  { type: 'action', label: 'Duration of Action', sublabel: 'LEFT' },
  { type: 'halfLife', label: 'Half-Life', sublabel: 'LEFT' },
  { type: 'clearance', label: 'Clearance Time', sublabel: 'LEFT' },
];

function DetailTimerRing({
  takenAt,
  halfLifeMinutes,
  timerType,
  isSelected,
  onPress,
  pillColor,
}: {
  takenAt: Date;
  halfLifeMinutes: number;
  timerType: TimerType;
  isSelected: boolean;
  onPress: () => void;
  pillColor: string;
}) {
  const { timeLabel, progress, minutesRemaining } = useCountdown(takenAt, halfLifeMinutes, timerType);
  const config = TIMER_CONFIGS.find((c) => c.type === timerType)!;
  const isDone = minutesRemaining <= 0;

  const size = 112;
  const strokeWidth = isSelected ? 10 : 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const remaining = 1 - Math.min(1, Math.max(0, progress));
  const strokeDashoffset = circumference * (1 - remaining);
  const ringColor = isSelected ? colors.secondary : colors.primaryContainer;

  return (
    <Pressable
      style={[
        styles.timerButton,
        isSelected && styles.timerButtonSelected,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${config.label}, ${isDone ? 'complete' : timeLabel + ' remaining'}${isSelected ? ', selected as dashboard timer' : ''}`}
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
            strokeDashoffset={strokeDashoffset}
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
        color={isSelected ? 'primary' : 'onSurface'}
        style={styles.timerLabel}
      >
        {config.label}
      </Typography>
    </Pressable>
  );
}

function InactiveTimerRing({
  halfLifeMinutes,
  timerType,
  isSelected,
  onPress,
}: {
  halfLifeMinutes: number;
  timerType: TimerType;
  isSelected: boolean;
  onPress: () => void;
}) {
  const config = TIMER_CONFIGS.find((c) => c.type === timerType)!;
  const totalMinutes = timerDurationMinutes(halfLifeMinutes, timerType);
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

export default function PillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { pills, activeDoses, updatePill, deletePill, recordDose } = usePillStore();

  const pill = useMemo(() => pills.find((p) => p.id === id), [pills, id]);
  const activeDose: Dose | undefined = useMemo(() => {
    if (!pill) return undefined;
    const dose = activeDoses.find((d) => d.pillId === pill.id);
    if (!dose) return undefined;
    if (dose.eliminationAt.getTime() <= Date.now()) return undefined;
    return dose;
  }, [activeDoses, pill]);

  const [editingDosage, setEditingDosage] = useState(false);
  const [dosageText, setDosageText] = useState('');

  if (!pill) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Typography variant="bodyLg" color="onSurfaceVariant">Pill not found</Typography>
        </View>
      </SafeAreaView>
    );
  }

  const handleSelectTimer = async (timerType: TimerType) => {
    if (!user || pill.preferredTimer === timerType) return;
    await updatePill(user.uid, pill.id, { preferredTimer: timerType });
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
    const newDosage = parseFloat(dosageText);
    if (!user || isNaN(newDosage) || newDosage <= 0) {
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <Ionicons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Typography variant="titleMd" color="primary" style={styles.headerTitle}>
          HalfLifeControl
        </Typography>
        <View style={styles.headerSpacer} />
      </View>

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
            {TIMER_CONFIGS.map(({ type }) =>
              activeDose ? (
                <DetailTimerRing
                  key={type}
                  takenAt={activeDose.takenAt}
                  halfLifeMinutes={activeDose.halfLifeMinutes}
                  timerType={type}
                  isSelected={pill.preferredTimer === type}
                  onPress={() => handleSelectTimer(type)}
                  pillColor={pill.color}
                />
              ) : (
                <InactiveTimerRing
                  key={type}
                  halfLifeMinutes={pill.halfLifeMinutes}
                  timerType={type}
                  isSelected={pill.preferredTimer === type}
                  onPress={() => handleSelectTimer(type)}
                />
              ),
            )}
          </View>
        </View>

        {/* Edit dosage */}
        <View style={styles.dosageSection}>
          <Typography variant="titleLg" color="onSurface">
            Edit Dosage
          </Typography>
          <Pressable
            style={styles.dosageRow}
            onPress={startEditDosage}
            accessibilityRole="button"
            accessibilityLabel={`Current dosage: ${pill.dosageMg} ${pill.dosageUnit}. Tap to edit.`}
          >
            {editingDosage ? (
              <TextInput
                style={styles.dosageInput}
                value={dosageText}
                onChangeText={setDosageText}
                keyboardType="numeric"
                autoFocus
                onBlur={handleSaveDosage}
                onSubmitEditing={handleSaveDosage}
                selectTextOnFocus
              />
            ) : (
              <View style={styles.dosageDisplay}>
                <Typography variant="displaySm" color="primary" align="center">
                  {pill.dosageMg}
                </Typography>
              </View>
            )}
            <Typography variant="titleLg" color="onSurfaceVariant">
              {pill.dosageUnit}
            </Typography>
          </Pressable>
        </View>

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
    paddingBottom: spacing[24],
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
  deleteButtonPressed: {
    backgroundColor: colors.errorContainer + '33',
  },
});
