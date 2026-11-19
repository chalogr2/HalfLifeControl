import type { Dose } from './types';

/**
 * The dose a pill's timers should follow: the most recently taken one that is
 * still active and not yet eliminated.
 *
 * A pill can hold several active doses at once (a long half-life drug taken
 * on consecutive days, or auto-assume backfilling missed occurrences), and
 * the store keeps them in insertion order. Picking the first match showed the
 * *oldest* dose, so taking the pill again looked like it did nothing.
 */
export function latestActiveDose(
  doses: Dose[],
  pillId: string,
  now: number = Date.now(),
): Dose | undefined {
  let latest: Dose | undefined;
  for (const d of doses) {
    if (d.pillId !== pillId || d.status !== 'active') continue;
    if (d.eliminationAt.getTime() <= now) continue;
    if (!latest || d.takenAt.getTime() > latest.takenAt.getTime()) latest = d;
  }
  return latest;
}

/**
 * Overlay doses recorded or changed on this device onto a fetched history
 * list (matched by id, local copy wins), drop dismissed doses, and sort
 * newest first. Lets the History tab stay current without re-querying.
 */
export function mergeDoseHistory(fetched: Dose[], local: Dose[]): Dose[] {
  const byId = new Map<string, Dose>();
  for (const d of fetched) byId.set(d.id, d);
  for (const d of local) byId.set(d.id, d);
  return Array.from(byId.values())
    .filter((d) => d.status !== 'dismissed')
    .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());
}
