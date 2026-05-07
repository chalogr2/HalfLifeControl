/**
 * Scheduling helpers — pure functions, no React or backend dependencies.
 */
import type { PillSchedule, ScheduleFrequency } from './types';

/** Parse "HH:mm" to { hours, minutes }. */
function parseTime(timeOfDay: string): { hours: number; minutes: number } {
  const [h, m] = timeOfDay.split(':').map(Number);
  return { hours: h, minutes: m };
}

/** Get the next scheduled Date for a pill schedule from `now`. */
export function nextScheduledDose(schedule: PillSchedule, now: Date = new Date()): Date {
  const { hours, minutes } = parseTime(schedule.timeOfDay);

  if (schedule.frequency === 'daily') {
    return nextDailyDose(hours, minutes, now);
  }

  if (schedule.frequency === 'specific_days' && schedule.daysOfWeek?.length) {
    return nextSpecificDayDose(hours, minutes, schedule.daysOfWeek, now);
  }

  if (schedule.frequency === 'every_n_days' && schedule.intervalDays) {
    return nextIntervalDose(hours, minutes, schedule.intervalDays, now);
  }

  // Fallback: treat as daily
  return nextDailyDose(hours, minutes, now);
}

function nextDailyDose(hours: number, minutes: number, now: Date): Date {
  const today = new Date(now);
  today.setHours(hours, minutes, 0, 0);
  if (today.getTime() > now.getTime()) return today;
  // Tomorrow
  today.setDate(today.getDate() + 1);
  return today;
}

function nextSpecificDayDose(hours: number, minutes: number, daysOfWeek: number[], now: Date): Date {
  const sorted = [...daysOfWeek].sort((a, b) => a - b);
  const currentDay = now.getDay();

  // Try today first
  if (sorted.includes(currentDay)) {
    const today = new Date(now);
    today.setHours(hours, minutes, 0, 0);
    if (today.getTime() > now.getTime()) return today;
  }

  // Find the next day in the list
  for (const day of sorted) {
    if (day > currentDay) {
      const diff = day - currentDay;
      const next = new Date(now);
      next.setDate(next.getDate() + diff);
      next.setHours(hours, minutes, 0, 0);
      return next;
    }
  }

  // Wrap to next week
  const firstDay = sorted[0];
  const diff = 7 - currentDay + firstDay;
  const next = new Date(now);
  next.setDate(next.getDate() + diff);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function nextIntervalDose(hours: number, minutes: number, intervalDays: number, now: Date): Date {
  // Without a reference "last taken" date, we compute from today's scheduled time
  const today = new Date(now);
  today.setHours(hours, minutes, 0, 0);
  if (today.getTime() > now.getTime()) return today;
  today.setDate(today.getDate() + intervalDays);
  return today;
}

/**
 * Most recent past Date this schedule should have fired before `now`.
 *
 * Returns null for `every_n_days` schedules: without a stored "cycle anchor"
 * date on the pill, we can't tell which cycle we're in, so auto-assume
 * reconciliation is intentionally a no-op for that frequency. Daily +
 * specific-days callers always get a real Date.
 */
export function previousScheduledDose(schedule: PillSchedule, now: Date = new Date()): Date | null {
  const { hours, minutes } = parseTime(schedule.timeOfDay);

  if (schedule.frequency === 'daily') {
    return previousDailyDose(hours, minutes, now);
  }

  if (schedule.frequency === 'specific_days' && schedule.daysOfWeek?.length) {
    return previousSpecificDayDose(hours, minutes, schedule.daysOfWeek, now);
  }

  if (schedule.frequency === 'every_n_days') {
    return null;
  }

  return previousDailyDose(hours, minutes, now);
}

function previousDailyDose(hours: number, minutes: number, now: Date): Date {
  const today = new Date(now);
  today.setHours(hours, minutes, 0, 0);
  if (today.getTime() <= now.getTime()) return today;
  today.setDate(today.getDate() - 1);
  return today;
}

function previousSpecificDayDose(hours: number, minutes: number, daysOfWeek: number[], now: Date): Date {
  // Walk back day-by-day up to a full week and pick the first match whose
  // time-of-day has already passed. Bounded loop — never spins.
  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() - offset);
    candidate.setHours(hours, minutes, 0, 0);
    if (candidate.getTime() > now.getTime()) continue;
    if (daysOfWeek.includes(candidate.getDay())) return candidate;
  }
  // Should be unreachable for non-empty daysOfWeek; safety fallback.
  const fallback = new Date(now);
  fallback.setDate(fallback.getDate() - 7);
  fallback.setHours(hours, minutes, 0, 0);
  return fallback;
}

/** Human-friendly schedule description. */
export function describeSchedule(schedule: PillSchedule): string {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (schedule.frequency === 'daily') {
    return `Daily at ${schedule.timeOfDay}`;
  }

  if (schedule.frequency === 'specific_days' && schedule.daysOfWeek?.length) {
    const days = schedule.daysOfWeek.map((d) => dayNames[d]).join(', ');
    return `${days} at ${schedule.timeOfDay}`;
  }

  if (schedule.frequency === 'every_n_days' && schedule.intervalDays) {
    return `Every ${schedule.intervalDays} days at ${schedule.timeOfDay}`;
  }

  return `At ${schedule.timeOfDay}`;
}
