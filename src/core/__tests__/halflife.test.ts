import {
  concentration,
  eliminationDate,
  eliminationProgress,
  formatTimeRemaining,
  minutesRemaining,
  timerDurationMinutes,
  timerMinutesRemaining,
} from '../halflife';

const takenAt = new Date('2026-11-17T08:00:00Z');
const plus = (minutes: number) => new Date(takenAt.getTime() + minutes * 60_000);

describe('concentration', () => {
  it('halves every half-life', () => {
    expect(concentration(0, 120)).toBe(100);
    expect(concentration(120, 120)).toBeCloseTo(50);
    expect(concentration(240, 120)).toBeCloseTo(25);
  });

  it('is ~3% after five half-lives (the clearance threshold)', () => {
    expect(concentration(600, 120)).toBeCloseTo(3.125);
  });

  it('guards invalid inputs', () => {
    expect(concentration(-5, 120)).toBe(100);
    expect(concentration(10, 0)).toBe(0);
  });
});

describe('timerDurationMinutes', () => {
  it('uses fixed multipliers for halfLife and clearance', () => {
    expect(timerDurationMinutes(120, 'halfLife')).toBe(120);
    expect(timerDurationMinutes(120, 'clearance')).toBe(600);
  });

  it('prefers a curated duration of action over the 2× fallback', () => {
    expect(timerDurationMinutes(2040, 'action', 600)).toBe(600);
    expect(timerDurationMinutes(120, 'action', null)).toBe(240);
    expect(timerDurationMinutes(120, 'action', 0)).toBe(240);
  });

  it('ignores the curated value for non-action timers', () => {
    expect(timerDurationMinutes(120, 'clearance', 30)).toBe(600);
  });
});

describe('elimination timing', () => {
  it('eliminates after 5 half-lives', () => {
    expect(eliminationDate(takenAt, 60)).toEqual(plus(300));
  });

  it('counts down and clamps at zero', () => {
    expect(minutesRemaining(takenAt, 60, plus(100))).toBeCloseTo(200);
    expect(minutesRemaining(takenAt, 60, plus(400))).toBe(0);
  });

  it('reports progress clamped to [0, 1]', () => {
    expect(eliminationProgress(takenAt, 60, plus(150))).toBeCloseTo(0.5);
    expect(eliminationProgress(takenAt, 60, plus(-10))).toBe(0);
    expect(eliminationProgress(takenAt, 60, plus(1000))).toBe(1);
  });

  it('computes per-timer remaining time', () => {
    expect(timerMinutesRemaining(takenAt, 60, 'halfLife', plus(30))).toBeCloseTo(30);
    expect(timerMinutesRemaining(takenAt, 60, 'action', plus(30), 45)).toBeCloseTo(15);
  });
});

describe('formatTimeRemaining', () => {
  it.each([
    [0, 'Eliminated'],
    [0.5, '30s'],
    [5.25, '5m 15s'],
    [120, '2h'],
    [125, '2h 5m'],
  ])('%p min → %p', (minutes, expected) => {
    expect(formatTimeRemaining(minutes)).toBe(expected);
  });
});
