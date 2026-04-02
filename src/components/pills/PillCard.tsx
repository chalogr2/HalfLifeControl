import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Typography } from '@/components/ui/Typography';
import { CountdownTimer } from './CountdownTimer';
import { describeSchedule } from '@/core/scheduling';
import type { Pill, Dose } from '@/core/types';
import { colors, spacing, MIN_TOUCH_TARGET } from '@/theme';

interface PillCardProps {
  pill: Pill;
  /** Currently active dose for this pill, if any. */
  activeDose?: Dose | null;
  /** Next scheduled dose label, e.g. "Next: 8:30 AM". */
  nextDoseLabel?: string;
  onPress?: () => void;
  /** Called when the play (take dose) button is tapped. */
  onTakeDose?: () => void;
}

export function PillCard({ pill, activeDose, nextDoseLabel, onPress, onTakeDose }: PillCardProps) {
  const variant = pill.pillType === 'scheduled' ? 'scheduled' : 'random';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
      accessibilityRole="button"
      accessibilityLabel={`${pill.drugName}, ${pill.dosageMg} ${pill.dosageUnit}${activeDose ? ', currently tracking' : ''}${nextDoseLabel ? `, ${nextDoseLabel}` : ''}`}
      accessibilityHint={activeDose ? 'Currently tracking this dose' : 'Double tap to record a dose'}
    >
      <Card variant={variant} accentColor={pill.color}>
        <View style={styles.row}>
          <View style={styles.info}>
            <Typography variant="titleMd" color="onSurface" numberOfLines={1}>
              {pill.drugName}
            </Typography>
            <Typography variant="bodyMd" color="onSurfaceVariant">
              {pill.dosageMg} {pill.dosageUnit}
              {pill.schedule ? ` · ${describeSchedule(pill.schedule)}` : ''}
            </Typography>
            {!activeDose && nextDoseLabel && (
              <Typography variant="labelMd" color="primary">
                {nextDoseLabel}
              </Typography>
            )}
          </View>

          {activeDose ? (
            <CountdownTimer
              takenAt={activeDose.takenAt}
              halfLifeMinutes={activeDose.halfLifeMinutes}
              color={pill.color}
              timerType={pill.preferredTimer}
            />
          ) : (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onTakeDose?.();
              }}
              style={[styles.takeButton, { backgroundColor: pill.color }]}
              accessibilityRole="button"
              accessibilityLabel={`Take ${pill.drugName}`}
              hitSlop={4}
            >
              <Ionicons name="play" size={20} color="#fff" />
            </Pressable>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH_TARGET,
  },
  info: {
    flex: 1,
    marginRight: spacing[3],
    gap: spacing[1],
  },
  pressed: {
    opacity: 0.85,
  },
  takeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
