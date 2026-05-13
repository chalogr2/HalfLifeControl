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
 * Enumerate every scheduled occurrence in the open interval `(from, to]` for
 * a given schedule. Used by the autoAssumeTaken reconciliation pass to find
 * every dose that should have been recorded since the last anchor.
 *
 * Returns `[]` for `every_n_days` schedules — they have no stored cycle
 * anchor, so we can't enumerate occurrences without guessing. Daily and
 * specific_days both walk the calendar day-by-day with a hard iteration
 * cap so a pathological input can't spin forever.
 *
 * Occurrences are returned ascending by time.
 */
export function missedScheduledDoses(
  schedule: PillSchedule,
  from: Date,
  to: Date,
): Date[] {
  if (from.getTime() >= to.getTime()) return [];
  if (schedule.frequency === 'every_n_days') return [];

  const { hours, minutes } = parseTime(schedule.timeOfDay);
  const results: Date[] = [];

  // Start at `from`'s calendar day with the schedule's time-of-day. If that
  // moment is at-or-before `from`, advance one day so we never emit the
  // anchor itself (the open lower bound).
  const cursor = new Date(from);
  cursor.setHours(hours, minutes, 0, 0);
  if (cursor.getTime() <= from.getTime()) {
    cursor.setDate(cursor.getDate() + 1);
  }

  // Hard cap. ~2 years of daily walking is way past any realistic backfill;
  // protects against malformed inputs (e.g. `to` set to a far-future date).
  const MAX_ITERATIONS = 800;
  let iterations = 0;

  while (cursor.getTime() <= to.getTime() && iterations < MAX_ITERATIONS) {
    if (schedule.frequency === 'daily') {
      results.push(new Date(cursor));
    } else if (schedule.frequency === 'specific_days' && schedule.daysOfWeek?.length) {
      if (schedule.daysOfWeek.includes(cursor.getDay())) {
        results.push(new Date(cursor));
      }
    }
    cursor.setDate(cursor.getDate() + 1);
    iterations++;
  }

  return results;
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
