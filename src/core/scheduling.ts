/**
 * Scheduling helpers — pure functions, no React or backend dependencies.
 *
 * All calendar math is done in the device's local time zone with
 * `setDate`/`setHours`, so DST transitions keep wall-clock times stable
 * (a dose at 08:00 stays at 08:00 across a DST change).
 */
import type { PillSchedule, ScheduleFrequency } from './types';

const MS_PER_DAY = 86_400_000;

// ─── Time-of-day parsing ─────────────────────────────

/** Parse "HH:mm" to { hours, minutes }. Assumes a validated string. */
function parseTime(timeOfDay: string): { hours: number; minutes: number } {
  const [h, m] = timeOfDay.split(':').map(Number);
  return { hours: h, minutes: m };
}

/**
 * Normalize user-typed times to canonical "HH:mm", or return null if the
 * input isn't a valid 24-hour time. Accepts "8:00", "08:00", "8", "0800",
 * "8.30". Anything that could be ambiguous (AM/PM text, >23h) is rejected
 * rather than guessed.
 */
export function normalizeTimeOfDay(input: string): string | null {
  const s = input.trim().replace('.', ':');
  let h: number;
  let m: number;

  let match = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (match) {
    h = Number(match[1]);
    m = Number(match[2]);
  } else if ((match = /^(\d{1,2})$/.exec(s))) {
    h = Number(match[1]);
    m = 0;
  } else if ((match = /^(\d{2})(\d{2})$/.exec(s))) {
    h = Number(match[1]);
    m = Number(match[2]);
  } else {
    return null;
  }

  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─── Local calendar-day helpers ──────────────────────

/** Local midnight of the given instant's calendar day. */
export function startOfLocalDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

/** Format a date's local calendar day as "YYYY-MM-DD". */
export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse "YYYY-MM-DD" as local midnight. Returns null on malformed input. */
export function parseLocalDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Whole calendar days from `a` to `b` (local). Rounds to absorb the ±1h a
 * DST transition adds to the raw millisecond difference.
 */
function localDaysBetween(a: Date, b: Date): number {
  return Math.round((startOfLocalDay(b).getTime() - startOfLocalDay(a).getTime()) / MS_PER_DAY);
}

/** Days are a non-negative multiple of `n` away from the anchor day. */
function isIntervalDay(day: Date, anchorDay: Date, n: number): boolean {
  const diff = localDaysBetween(anchorDay, day);
  return diff >= 0 && diff % n === 0;
}

/**
 * The anchor day (local midnight) of an `every_n_days` cycle: the schedule's
 * own `startDate` if present, otherwise `fallbackStart` (callers pass the
 * pill's createdAt so legacy rows keep a stable cycle). Null if neither exists.
 */
export function intervalAnchorDay(schedule: PillSchedule, fallbackStart?: Date): Date | null {
  if (schedule.startDate) {
    const parsed = parseLocalDateKey(schedule.startDate);
    if (parsed) return parsed;
  }
  return fallbackStart ? startOfLocalDay(fallbackStart) : null;
}

// ─── Next occurrence ─────────────────────────────────

/**
 * Get the next scheduled Date strictly after `now`.
 *
 * @param fallbackStart - Cycle anchor for legacy `every_n_days` schedules
 *   that predate `startDate` (pass the pill's createdAt).
 */
export function nextScheduledDose(
  schedule: PillSchedule,
  now: Date = new Date(),
  fallbackStart?: Date,
): Date {
  const { hours, minutes } = parseTime(schedule.timeOfDay);

  if (schedule.frequency === 'daily') {
    return nextDailyDose(hours, minutes, now);
  }

  if (schedule.frequency === 'specific_days' && schedule.daysOfWeek?.length) {
    return nextSpecificDayDose(hours, minutes, schedule.daysOfWeek, now);
  }

  if (schedule.frequency === 'every_n_days' && schedule.intervalDays && schedule.intervalDays > 0) {
    const anchor = intervalAnchorDay(schedule, fallbackStart) ?? startOfLocalDay(now);
    return nextIntervalDose(hours, minutes, schedule.intervalDays, anchor, now);
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

function nextIntervalDose(
  hours: number,
  minutes: number,
  intervalDays: number,
  anchorDay: Date,
  now: Date,
): Date {
  const candidate = startOfLocalDay(now);
  const diff = localDaysBetween(anchorDay, candidate);

  if (diff < 0) {
    // Cycle hasn't started yet — first occurrence is the anchor day itself.
    const first = new Date(anchorDay);
    first.setHours(hours, minutes, 0, 0);
    return first;
  }

  // Advance to the first cycle day on or after today.
  const offset = diff % intervalDays;
  if (offset !== 0) candidate.setDate(candidate.getDate() + (intervalDays - offset));
  candidate.setHours(hours, minutes, 0, 0);

  // Today was a cycle day but the time has already passed → next cycle.
  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + intervalDays);
  }
  return candidate;
}

// ─── Missed occurrences (autoAssumeTaken backfill) ───

/**
 * Enumerate every scheduled occurrence in the open interval `(from, to]` for
 * a given schedule. Used by the autoAssumeTaken reconciliation pass to find
 * every dose that should have been recorded since the last anchor.
 *
 * `every_n_days` uses the schedule's `startDate` (or `fallbackStart` for
 * legacy rows); with neither it returns `[]` rather than guessing a cycle.
 * All frequencies walk the calendar day-by-day with a hard iteration cap so
 * a pathological input can't spin forever.
 *
 * Occurrences are returned ascending by time.
 */
export function missedScheduledDoses(
  schedule: PillSchedule,
  from: Date,
  to: Date,
  fallbackStart?: Date,
): Date[] {
  if (from.getTime() >= to.getTime()) return [];

  let intervalAnchor: Date | null = null;
  if (schedule.frequency === 'every_n_days') {
    if (!schedule.intervalDays || schedule.intervalDays < 1) return [];
    intervalAnchor = intervalAnchorDay(schedule, fallbackStart);
    if (!intervalAnchor) return [];
  }

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
    } else if (intervalAnchor && schedule.intervalDays) {
      if (isIntervalDay(cursor, intervalAnchor, schedule.intervalDays)) {
        results.push(new Date(cursor));
      }
    }
    cursor.setDate(cursor.getDate() + 1);
    iterations++;
  }

  return results;
}

// ─── Building / validating schedules from form input ─

/** When an `every_n_days` cycle starts. 'keep' preserves an existing cycle (edit only). */
export type IntervalStart = 'today' | 'tomorrow' | 'keep';

/** Raw form state shared by the add-pill and edit-schedule screens. */
export interface ScheduleDraft {
  frequency: ScheduleFrequency;
  timeOfDay: string;
  daysOfWeek: number[];
  /** Text from the interval input; parsed and validated in `buildSchedule`. */
  intervalDays: string;
  intervalStart: IntervalStart;
}

export type BuildScheduleResult =
  | { ok: true; schedule: PillSchedule }
  | { ok: false; title: string; message: string };

/**
 * Validate a draft and turn it into a stored `PillSchedule`.
 *
 * @param keepStartDate - The cycle anchor to reuse when `intervalStart` is
 *   'keep' (the existing schedule's startDate, or its legacy fallback).
 */
export function buildSchedule(
  draft: ScheduleDraft,
  now: Date = new Date(),
  keepStartDate?: string,
): BuildScheduleResult {
  const timeOfDay = normalizeTimeOfDay(draft.timeOfDay);
  if (!timeOfDay) {
    return {
      ok: false,
      title: 'Check the reminder time',
      message: 'Enter a 24-hour time like 08:00 or 21:30.',
    };
  }

  const effectiveFrom = now.toISOString();

  if (draft.frequency === 'specific_days') {
    // Without at least one day, nextScheduledDose() silently degrades to daily
    // while the notification scheduler creates zero reminders — same data row,
    // two different effective schedules. Block at the entry point.
    if (draft.daysOfWeek.length === 0) {
      return {
        ok: false,
        title: 'Pick at least one day',
        message: 'Select which days of the week you take this medication.',
      };
    }
    const daysOfWeek = [...new Set(draft.daysOfWeek)].sort((a, b) => a - b);
    return { ok: true, schedule: { timeOfDay, frequency: 'specific_days', daysOfWeek, effectiveFrom } };
  }

  if (draft.frequency === 'every_n_days') {
    const intervalDays = Number(draft.intervalDays.trim());
    if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 365) {
      return {
        ok: false,
        title: 'Pick an interval',
        message: 'Enter a whole number of days (1 to 365) between doses.',
      };
    }

    let startDate: string;
    if (draft.intervalStart === 'keep' && keepStartDate) {
      startDate = keepStartDate;
    } else if (draft.intervalStart === 'tomorrow') {
      const tomorrow = startOfLocalDay(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      startDate = toLocalDateKey(tomorrow);
    } else {
      startDate = toLocalDateKey(now);
    }

    return {
      ok: true,
      schedule: { timeOfDay, frequency: 'every_n_days', intervalDays, startDate, effectiveFrom },
    };
  }

  return { ok: true, schedule: { timeOfDay, frequency: 'daily', effectiveFrom } };
}

/**
 * True when two schedules describe the same occurrences (ignores
 * `effectiveFrom`, which is bookkeeping, not part of the schedule itself).
 */
export function sameSchedule(a: PillSchedule, b: PillSchedule): boolean {
  if (a.frequency !== b.frequency || a.timeOfDay !== b.timeOfDay) return false;
  if (a.frequency === 'specific_days') {
    const da = [...(a.daysOfWeek ?? [])].sort().join(',');
    const db = [...(b.daysOfWeek ?? [])].sort().join(',');
    return da === db;
  }
  if (a.frequency === 'every_n_days') {
    return a.intervalDays === b.intervalDays && a.startDate === b.startDate;
  }
  return true;
}

// ─── Display ─────────────────────────────────────────

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
    if (schedule.intervalDays === 1) return `Daily at ${schedule.timeOfDay}`;
    return `Every ${schedule.intervalDays} days at ${schedule.timeOfDay}`;
  }

  return `At ${schedule.timeOfDay}`;
}

/**
 * Relative label for an upcoming dose: "Today 8:00 AM", "Tomorrow 8:00 AM",
 * "Wed 8:00 AM" (within a week), or "Nov 21, 8:00 AM" beyond that.
 */
export function formatNextDose(next: Date, now: Date = new Date()): string {
  const h = next.getHours();
  const m = next.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const time = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;

  const days = localDaysBetween(now, next);
  if (days <= 0) return `Today ${time}`;
  if (days === 1) return `Tomorrow ${time}`;
  if (days < 7) {
    return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][next.getDay()]} ${time}`;
  }
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][
    next.getMonth()
  ];
  return `${month} ${next.getDate()}, ${time}`;
}
