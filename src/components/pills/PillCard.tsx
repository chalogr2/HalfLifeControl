import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Typography } from '@/components/ui/Typography';
import { MarqueeText } from '@/components/ui/MarqueeText';
import { CountdownTimer } from './CountdownTimer';
import { describeSchedule } from '@/core/scheduling';
import {
  availableTimerTypes,
  pickEffectiveTimer,
  timerDurationMinutes,
  timerLabel,
} from '@/core/halflife';
import type { Pill, Dose } from '@/core/types';
import { spacing, MIN_TOUCH_TARGET } from '@/theme';

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

const PLAY_BUTTON_SIZE = 52;

/**
 * Layout strategy: the card-press Pressable and the play-button Pressable are
 * SIBLINGS, not nested. Nested Pressables in React Native (esp. with the New
 * Architecture + React 19) don't reliably isolate touches, and `e.stopPropagation()`
 * is a no-op on RN synthetic events. Siblings let each Pressable own its own
 * responder cleanly. The play button is absolutely positioned over the card's
 * right side so the visual layout is unchanged.
 */
export function PillCard({ pill, activeDose, nextDoseLabel, onPress, onTakeDose }: PillCardProps) {
  const variant = pill.pillType === 'scheduled' ? 'scheduled' : 'random';

  // Force a re-render at each timer's zero-crossing so pickEffectiveTimer
  // rolls over to the next-closest-to-zero the instant one finishes.
  // Cheaper than a 1s poll; uses the same pattern as dashboard.tsx prune timers.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!activeDose) return;
    const now = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const types = availableTimerTypes(pill.durationType);
    for (const t of types) {
      const totalMs =
        timerDurationMinutes(activeDose.halfLifeMinutes, t, activeDose.durationOfActionMinutes) *
        60_000;
      const delay = activeDose.takenAt.getTime() + totalMs - now;
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        timers.push(setTimeout(() => forceTick((x) => x + 1), delay + 150));
      }
    }
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [activeDose, pill.durationType]);

  const effectiveTimer = activeDose
    ? pickEffectiveTimer(
        pill.preferredTimer,
        activeDose.takenAt,
        activeDose.halfLifeMinutes,
        activeDose.durationOfActionMinutes,
        availableTimerTypes(pill.durationType),
      )
    : null;

  const statusText =
    activeDose && effectiveTimer
      ? timerLabel(
          effectiveTimer,
          activeDose.durationType,
          activeDose.isMaintenanceInterval ?? false,
        )
      : 'Inactive';

  return (
    <View>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => pressed && styles.pressed}
        accessibilityRole="button"
        accessibilityLabel={`${pill.drugName}, ${pill.dosageMg} ${pill.dosageUnit}${activeDose ? ', currently tracking' : ''}${nextDoseLabel ? `, ${nextDoseLabel}` : ''}`}
        accessibilityHint="Open pill details"
      >
        <Card variant={variant} accentColor={pill.color}>
          <View style={styles.row}>
            <View style={styles.info}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: pill.color }]} />
                <Typography
                  variant="labelMd"
                  color="onSurfaceVariant"
                  style={activeDose ? { color: pill.color } : undefined}
                >
                  {statusText}
                </Typography>
              </View>
              <MarqueeText variant="titleLg" color="onSurface">
                {pill.drugName}
              </MarqueeText>
              <Typography variant="bodyLg" color="onSurfaceVariant">
                {pill.dosageMg} {pill.dosageUnit}
                {pill.schedule ? ` · ${describeSchedule(pill.schedule)}` : ''}
              </Typography>
              {!activeDose && nextDoseLabel && (
                <Typography variant="labelLg" color="primary">
                  {nextDoseLabel}
                </Typography>
              )}
            </View>

            {activeDose && effectiveTimer ? (
              <CountdownTimer
                takenAt={activeDose.takenAt}
                halfLifeMinutes={activeDose.halfLifeMinutes}
                durationOfActionMinutes={activeDose.durationOfActionMinutes}
                color={pill.color}
                timerType={effectiveTimer}
              />
            ) : (
              // Placeholder keeps the row layout stable while the real button
              // lives outside the navigable Pressable.
              <View style={styles.takeButtonPlaceholder} />
            )}
          </View>
        </Card>
      </Pressable>

      {!activeDose && (
        <Pressable
          onPress={onTakeDose}
          style={({ pressed }) => [
            styles.takeButton,
            { backgroundColor: pill.color },
            pressed && styles.takeButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Take ${pill.drugName}`}
          hitSlop={8}
        >
          <Ionicons name="play" size={22} color="#fff" />
        </Pressable>
      )}
    </View>
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pressed: {
    opacity: 0.85,
  },
  takeButton: {
    position: 'absolute',
    right: spacing[5],
    top: '50%',
    marginTop: -(PLAY_BUTTON_SIZE / 2),
    width: PLAY_BUTTON_SIZE,
    height: PLAY_BUTTON_SIZE,
    borderRadius: PLAY_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  takeButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  takeButtonPlaceholder: {
    width: PLAY_BUTTON_SIZE,
    height: PLAY_BUTTON_SIZE,
  },
});
