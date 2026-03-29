import { useState, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  concentration as calcConcentration,
  minutesRemaining as calcMinutesRemaining,
  eliminationProgress as calcProgress,
  formatTimeRemaining,
} from '@/core/halflife';

interface CountdownState {
  /** Percentage of drug remaining (0–100). */
  concentration: number;
  /** Minutes until elimination. */
  minutesRemaining: number;
  /** 0→1 progress toward elimination. */
  progress: number;
  /** Human-readable time remaining, e.g. "4h 23m". */
  timeLabel: string;
  /** True when 5 half-lives have elapsed. */
  isEliminated: boolean;
}

/**
 * Reactive countdown driven by pure math — no drift.
 * Re-computes every second while foregrounded.
 * Catches up instantly on foreground resume.
 */
export function useCountdown(takenAt: Date, halfLifeMinutes: number): CountdownState {
  const compute = (): CountdownState => {
    const now = new Date();
    const elapsed = (now.getTime() - takenAt.getTime()) / 60_000;
    const conc = calcConcentration(elapsed, halfLifeMinutes);
    const remaining = calcMinutesRemaining(takenAt, halfLifeMinutes, now);
    const progress = calcProgress(takenAt, halfLifeMinutes, now);
    return {
      concentration: conc,
      minutesRemaining: remaining,
      progress,
      timeLabel: formatTimeRemaining(remaining),
      isEliminated: remaining <= 0,
    };
  };

  const [state, setState] = useState(compute);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Tick every second
    intervalRef.current = setInterval(() => setState(compute()), 1000);

    // Catch up on foreground resume
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        setState(compute());
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [takenAt.getTime(), halfLifeMinutes]);

  return state;
}
