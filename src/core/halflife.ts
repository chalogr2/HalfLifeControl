/**
 * Pure half-life math — no React, no backend dependencies.
 * Can be extracted for Watch apps.
 */

import type { TimerType } from './types';

/** Multiplier for each timer type (applied to halfLifeMinutes). */
export const TIMER_MULTIPLIER: Record<TimerType, number> = {
  action: 2,    // Therapeutic window (~25% remaining)
  halfLife: 1,  // 50% remaining
  clearance: 5, // ~97% eliminated
};

/** Total duration in minutes for a given timer type. */
export function timerDurationMinutes(halfLifeMinutes: number, timerType: TimerType): number {
  return halfLifeMinutes * TIMER_MULTIPLIER[timerType];
}

/** Concentration remaining as a percentage (0–100). */
export function concentration(elapsedMinutes: number, halfLifeMinutes: number): number {
  if (halfLifeMinutes <= 0) return 0;
  if (elapsedMinutes <= 0) return 100;
  return 100 * Math.pow(0.5, elapsedMinutes / halfLifeMinutes);
}

/** Minutes until ~97% elimination (5 half-lives). */
export function eliminationMinutes(halfLifeMinutes: number): number {
  return halfLifeMinutes * 5;
}

/** Absolute Date when the drug is considered eliminated. */
export function eliminationDate(takenAt: Date, halfLifeMinutes: number): Date {
  return new Date(takenAt.getTime() + eliminationMinutes(halfLifeMinutes) * 60_000);
}

/** Minutes remaining until elimination, clamped to >= 0. */
export function minutesRemaining(takenAt: Date, halfLifeMinutes: number, now: Date = new Date()): number {
  const elimAt = eliminationDate(takenAt, halfLifeMinutes);
  return Math.max(0, (elimAt.getTime() - now.getTime()) / 60_000);
}

/** Progress as 0→1 (0 = just taken, 1 = fully eliminated). */
export function eliminationProgress(takenAt: Date, halfLifeMinutes: number, now: Date = new Date()): number {
  const totalMs = eliminationMinutes(halfLifeMinutes) * 60_000;
  if (totalMs <= 0) return 1;
  const elapsed = now.getTime() - takenAt.getTime();
  return Math.min(1, Math.max(0, elapsed / totalMs));
}

/** Minutes remaining for a specific timer type, clamped to >= 0. */
export function timerMinutesRemaining(
  takenAt: Date,
  halfLifeMinutes: number,
  timerType: TimerType,
  now: Date = new Date(),
): number {
  const totalMs = timerDurationMinutes(halfLifeMinutes, timerType) * 60_000;
  const endAt = takenAt.getTime() + totalMs;
  return Math.max(0, (endAt - now.getTime()) / 60_000);
}

/** Progress as 0→1 for a specific timer type. */
export function timerProgress(
  takenAt: Date,
  halfLifeMinutes: number,
  timerType: TimerType,
  now: Date = new Date(),
): number {
  const totalMs = timerDurationMinutes(halfLifeMinutes, timerType) * 60_000;
  if (totalMs <= 0) return 1;
  const elapsed = now.getTime() - takenAt.getTime();
  return Math.min(1, Math.max(0, elapsed / totalMs));
}

/** Format minutes as "Xh Ym", "Ym Zs", or "Xh" depending on magnitude. */
export function formatTimeRemaining(minutes: number): string {
  if (minutes <= 0) return 'Eliminated';
  const totalSeconds = Math.round(minutes * 60);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h === 0 && m === 0) return `${s}s`;
  if (h === 0) return `${m}m ${s}s`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
