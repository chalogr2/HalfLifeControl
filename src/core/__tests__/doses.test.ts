import { latestActiveDose, mergeDoseHistory } from '../doses';
import { parsePositiveNumber } from '../numbers';
import type { Dose } from '../types';

function dose(id: string, takenAt: string, overrides: Partial<Dose> = {}): Dose {
  const t = new Date(takenAt);
  return {
    id,
    pillId: 'p1',
    drugName: 'Testamine',
    takenAt: t,
    scheduledFor: null,
    halfLifeMinutes: 60,
    durationOfActionMinutes: null,
    durationType: 'action',
    isMaintenanceInterval: false,
    requiresWeeklyWarning: false,
    eliminationAt: new Date(t.getTime() + 48 * 3600_000),
    status: 'active',
    source: 'manual',
    createdAt: t,
    ...overrides,
  };
}

describe('parsePositiveNumber', () => {
  it.each([
    ['2.5', 2.5],
    ['2,5', 2.5], // comma-decimal Android keyboards
    ['0,5', 0.5], // used to parse as 0 → "Missing half-life"
    [' 8 ', 8],
    ['.5', 0.5],
    ['12.', 12],
  ])('parses %p', (input, expected) => {
    expect(parsePositiveNumber(input)).toBe(expected);
  });

  it.each(['', '  ', '0', '0.0', '-3', 'abc', '2.5.1', '1e3', '~12', '4-6'])(
    'rejects %p',
    (input) => {
      expect(parsePositiveNumber(input)).toBeNull();
    },
  );
});

describe('latestActiveDose', () => {
  const now = new Date('2026-11-18T12:00:00Z').getTime();

  it('picks the newest active dose, not the first inserted', () => {
    const doses = [dose('old', '2026-11-17T08:00:00Z'), dose('new', '2026-11-18T08:00:00Z')];
    expect(latestActiveDose(doses, 'p1', now)?.id).toBe('new');
  });

  it('skips eliminated, dismissed and other pills', () => {
    const doses = [
      dose('gone', '2026-11-10T08:00:00Z'),
      dose('dismissed', '2026-11-18T09:00:00Z', { status: 'dismissed' }),
      dose('other', '2026-11-18T10:00:00Z', { pillId: 'p2' }),
    ];
    expect(latestActiveDose(doses, 'p1', now)).toBeUndefined();
  });
});

describe('mergeDoseHistory', () => {
  it('adds session doses, lets local copies win, drops dismissed, sorts newest first', () => {
    const fetched = [dose('a', '2026-11-16T08:00:00Z'), dose('b', '2026-11-17T08:00:00Z')];
    const local = [
      dose('b', '2026-11-17T08:00:00Z', { status: 'dismissed' }),
      dose('c', '2026-11-18T08:00:00Z'),
    ];
    expect(mergeDoseHistory(fetched, local).map((d) => d.id)).toEqual(['c', 'a']);
  });
});
