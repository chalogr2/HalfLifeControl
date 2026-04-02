import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useCountdown } from '@/hooks/useCountdown';
import { ProgressRing } from './ProgressRing';
import { Typography } from '@/components/ui/Typography';
import { spacing } from '@/theme';
import type { TimerType } from '@/core/types';

interface CountdownTimerProps {
  takenAt: Date;
  halfLifeMinutes: number;
  color?: string;
  timerType?: TimerType;
}

/**
 * Shows a ring + concentration % + time remaining for an active dose.
 */
export function CountdownTimer({ takenAt, halfLifeMinutes, color, timerType = 'clearance' }: CountdownTimerProps) {
  const { progress, timeLabel, concentration, isEliminated } = useCountdown(takenAt, halfLifeMinutes, timerType);

  if (isEliminated) {
    return (
      <View style={styles.eliminated}>
        <Typography variant="labelMd" color="outline">
          Eliminated
        </Typography>
      </View>
    );
  }

  return (
    <View
      style={styles.container}
      accessibilityLabel={`${timeLabel} remaining, ${Math.round(concentration)}% concentration`}
    >
      <ProgressRing progress={progress} label={timeLabel} color={color} />
      <Typography variant="labelSm" color="onSurfaceVariant" style={styles.pct}>
        {Math.round(concentration)}%
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing[1],
  },
  pct: {
    textAlign: 'center',
  },
  eliminated: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 72,
  },
});
