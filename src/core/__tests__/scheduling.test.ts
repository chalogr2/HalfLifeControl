import {
  buildSchedule,
  formatNextDose,
  missedScheduledDoses,
  nextScheduledDose,
  normalizeTimeOfDay,
  sameSchedule,
  toLocalDateKey,
  type ScheduleDraft,
} from '../scheduling';
import type { PillSchedule } from '../types';

/** Local-time constructor shorthand: at(2026, 11, 16, 8) = Nov 16 2026 08:00 local. */
const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);

const everyThreeDays: PillSchedule = {
  timeOfDay: '08:00',
  frequency: 'every_n_days',
  intervalDays: 3,
  startDate: '2026-11-16',
};

describe('normalizeTimeOfDay', () => {
  it.each([
    ['08:00', '08:00'],
    ['8:00', '08:00'],
    ['8', '08:00'],
    ['0830', '08:30'],
    ['21.45', '21:45'],
    [' 7:05 ', '07:05'],
  ])('accepts %p as %p', (input, expected) => {
    expect(normalizeTimeOfDay(input)).toBe(expected);
  });

  it.each(['24:00', '12:60', '8am', '', 'abc', '123'])('rejects %p', (input) => {
    expect(normalizeTimeOfDay(input)).toBeNull();
  });
});

describe('nextScheduledDose — every_n_days', () => {
  it('returns the anchor day when its time has not passed', () => {
    expect(nextScheduledDose(everyThreeDays, at(2026, 11, 16, 7))).toEqual(at(2026, 11, 16, 8));
  });

  it('skips to the next cycle once the anchor-day time has passed', () => {
    expect(nextScheduledDose(everyThreeDays, at(2026, 11, 16, 9))).toEqual(at(2026, 11, 19, 8));
  });

  it('does not fire on off-cycle days (regression: used to return "today")', () => {
    // Nov 17 is day 1 of the 3-day cycle — the old code returned Nov 17 08:00.
    expect(nextScheduledDose(everyThreeDays, at(2026, 11, 17, 7))).toEqual(at(2026, 11, 19, 8));
    expect(nextScheduledDose(everyThreeDays, at(2026, 11, 18, 7))).toEqual(at(2026, 11, 19, 8));
  });

  it('walks a strict 3-day cadence when chained', () => {
    let cursor = at(2026, 11, 16, 0);
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      cursor = nextScheduledDose(everyThreeDays, cursor);
      seen.push(toLocalDateKey(cursor));
    }
    expect(seen).toEqual(['2026-11-16', '2026-11-19', '2026-11-22', '2026-11-25', '2026-11-28']);
  });

  it('waits for a start date in the future', () => {
    const s = { ...everyThreeDays, startDate: '2026-11-20' };
    expect(nextScheduledDose(s, at(2026, 11, 17, 12))).toEqual(at(2026, 11, 20, 8));
  });

  it('anchors legacy schedules (no startDate) on the fallback day', () => {
    const { startDate: _drop, ...legacy } = everyThreeDays;
    const createdAt = at(2026, 11, 16, 15, 30);
    expect(nextScheduledDose(legacy, at(2026, 11, 17, 7), createdAt)).toEqual(at(2026, 11, 19, 8));
  });

  it('keeps the wall-clock time across a DST change', () => {
    // EU clocks went back on 2026-10-25. Every-2-days from Oct 23 → Oct 25 → Oct 27.
    const s: PillSchedule = { timeOfDay: '08:00', frequency: 'every_n_days', intervalDays: 2, startDate: '2026-10-23' };
    const next = nextScheduledDose(s, at(2026, 10, 26, 12));
    expect(toLocalDateKey(next)).toBe('2026-10-27');
    expect(next.getHours()).toBe(8);
    expect(next.getMinutes()).toBe(0);
  });
});

describe('nextScheduledDose — daily / specific_days', () => {
  it('daily: today if upcoming, else tomorrow', () => {
    const s: PillSchedule = { timeOfDay: '08:00', frequency: 'daily' };
    expect(nextScheduledDose(s, at(2026, 11, 17, 7))).toEqual(at(2026, 11, 17, 8));
    expect(nextScheduledDose(s, at(2026, 11, 17, 9))).toEqual(at(2026, 11, 18, 8));
  });

  it('specific_days: wraps to next week', () => {
    // Nov 17 2026 is a Tuesday (2). Only Mondays (1) → next Monday Nov 23.
    const s: PillSchedule = { timeOfDay: '08:00', frequency: 'specific_days', daysOfWeek: [1] };
    expect(nextScheduledDose(s, at(2026, 11, 17, 12))).toEqual(at(2026, 11, 23, 8));
  });
});

describe('missedScheduledDoses', () => {
  it('enumerates every_n_days occurrences in (from, to]', () => {
    const got = missedScheduledDoses(everyThreeDays, at(2026, 11, 16, 0), at(2026, 11, 25, 12));
    expect(got.map(toLocalDateKey)).toEqual(['2026-11-16', '2026-11-19', '2026-11-22', '2026-11-25']);
  });

  it('excludes the open lower bound', () => {
    const got = missedScheduledDoses(everyThreeDays, at(2026, 11, 16, 8), at(2026, 11, 19, 8));
    expect(got).toEqual([at(2026, 11, 19, 8)]);
  });

  it('returns [] for every_n_days with no anchor at all', () => {
    const { startDate: _drop, ...legacy } = everyThreeDays;
    expect(missedScheduledDoses(legacy, at(2026, 11, 16), at(2026, 11, 25))).toEqual([]);
  });

  it('uses the fallback anchor for legacy every_n_days', () => {
    const { startDate: _drop, ...legacy } = everyThreeDays;
    const got = missedScheduledDoses(legacy, at(2026, 11, 16), at(2026, 11, 20), at(2026, 11, 16, 15));
    expect(got.map(toLocalDateKey)).toEqual(['2026-11-16', '2026-11-19']);
  });

  it('still handles daily and specific_days', () => {
    const daily: PillSchedule = { timeOfDay: '08:00', frequency: 'daily' };
    expect(missedScheduledDoses(daily, at(2026, 11, 16, 9), at(2026, 11, 18, 9))).toHaveLength(2);

    const mondays: PillSchedule = { timeOfDay: '08:00', frequency: 'specific_days', daysOfWeek: [1] };
    const got = missedScheduledDoses(mondays, at(2026, 11, 1), at(2026, 11, 30, 12));
    expect(got.map(toLocalDateKey)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
  });

  it('returns [] for an empty or inverted range', () => {
    expect(missedScheduledDoses(everyThreeDays, at(2026, 11, 20), at(2026, 11, 16))).toEqual([]);
  });
});

describe('buildSchedule', () => {
  const now = at(2026, 11, 17, 15);
  const draft = (patch: Partial<ScheduleDraft>): ScheduleDraft => ({
    frequency: 'daily',
    timeOfDay: '08:00',
    daysOfWeek: [],
    intervalDays: '2',
    intervalStart: 'today',
    ...patch,
  });

  it('normalizes the time and stamps effectiveFrom', () => {
    const r = buildSchedule(draft({ timeOfDay: '8:30' }), now);
    expect(r).toEqual({
      ok: true,
      schedule: { timeOfDay: '08:30', frequency: 'daily', effectiveFrom: now.toISOString() },
    });
  });

  it('rejects an invalid time', () => {
    expect(buildSchedule(draft({ timeOfDay: '25:00' }), now).ok).toBe(false);
  });

  it('rejects specific_days with no days selected', () => {
    expect(buildSchedule(draft({ frequency: 'specific_days' }), now).ok).toBe(false);
  });

  it('dedupes and sorts weekdays', () => {
    const r = buildSchedule(draft({ frequency: 'specific_days', daysOfWeek: [5, 1, 5] }), now);
    expect(r.ok && r.schedule.daysOfWeek).toEqual([1, 5]);
  });

  it.each(['0', '-1', '2.5', 'abc', '', '400'])('rejects interval %p', (intervalDays) => {
    expect(buildSchedule(draft({ frequency: 'every_n_days', intervalDays }), now).ok).toBe(false);
  });

  it('sets startDate from the start choice', () => {
    const today = buildSchedule(draft({ frequency: 'every_n_days', intervalStart: 'today' }), now);
    const tomorrow = buildSchedule(draft({ frequency: 'every_n_days', intervalStart: 'tomorrow' }), now);
    expect(today.ok && today.schedule.startDate).toBe('2026-11-17');
    expect(tomorrow.ok && tomorrow.schedule.startDate).toBe('2026-11-18');
  });

  it("keeps the existing cycle with 'keep'", () => {
    const r = buildSchedule(draft({ frequency: 'every_n_days', intervalStart: 'keep' }), now, '2026-11-01');
    expect(r.ok && r.schedule.startDate).toBe('2026-11-01');
  });

  it("falls back to today when 'keep' has nothing to keep", () => {
    const r = buildSchedule(draft({ frequency: 'every_n_days', intervalStart: 'keep' }), now);
    expect(r.ok && r.schedule.startDate).toBe('2026-11-17');
  });
});

describe('sameSchedule', () => {
  it('ignores effectiveFrom', () => {
    expect(sameSchedule({ ...everyThreeDays, effectiveFrom: 'a' }, { ...everyThreeDays, effectiveFrom: 'b' })).toBe(true);
  });

  it('detects time, interval, and anchor changes', () => {
    expect(sameSchedule(everyThreeDays, { ...everyThreeDays, timeOfDay: '09:00' })).toBe(false);
    expect(sameSchedule(everyThreeDays, { ...everyThreeDays, intervalDays: 2 })).toBe(false);
    expect(sameSchedule(everyThreeDays, { ...everyThreeDays, startDate: '2026-11-17' })).toBe(false);
  });

  it('compares weekdays order-insensitively', () => {
    const a: PillSchedule = { timeOfDay: '08:00', frequency: 'specific_days', daysOfWeek: [1, 3] };
    expect(sameSchedule(a, { ...a, daysOfWeek: [3, 1] })).toBe(true);
  });
});

describe('formatNextDose', () => {
  const now = at(2026, 11, 17, 12); // Tuesday
  it.each([
    [at(2026, 11, 17, 20), 'Today 8:00 PM'],
    [at(2026, 11, 18, 8), 'Tomorrow 8:00 AM'],
    [at(2026, 11, 20, 8, 5), 'Fri 8:05 AM'],
    [at(2026, 11, 30, 0, 30), 'Nov 30, 12:30 AM'],
  ])('%p → %p', (next, expected) => {
    expect(formatNextDose(next, now)).toBe(expected);
  });
});
