import { create } from 'zustand';
import type { Pill, Dose, DoseSource, DashboardDocument, TimerType } from '@/core/types';
import {
  loadDashboard,
  addPill as fbAddPill,
  updatePill as fbUpdatePill,
  deletePill as fbDeletePill,
  hardDeletePill as fbHardDeletePill,
  recordDose as fbRecordDose,
  updateDoseStatus as fbUpdateDoseStatus,
  fetchDosesSince as fbFetchDosesSince,
  initializeDashboardIfNeeded,
} from '@/services/supabase/pills';
import { cancelPillReminders } from '@/services/notifications';
import { missedScheduledDoses } from '@/core/scheduling';
import { useAuthStore } from '@/stores/useAuthStore';

interface PillState {
  pills: Pill[];
  activeDoses: Dose[];
  isLoading: boolean;

  /** Load from cache instantly, then sync from Supabase. */
  init: (userId: string) => Promise<void>;

  /** Reset state on sign-out. */
  reset: () => void;

  // Pills
  addPill: (userId: string, pill: Omit<Pill, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updatePill: (userId: string, pillId: string, data: Partial<Omit<Pill, 'id' | 'createdAt'>>) => Promise<void>;
  deletePill: (userId: string, pillId: string) => Promise<void>;
  /**
   * Hard-delete a pill (and all of its doses) from local cache + Supabase.
   * Used for one-time tracking pills whose tracking lifecycle has ended.
   */
  hardDeletePill: (userId: string, pillId: string) => Promise<void>;

  /**
   * Synchronous in-memory update of a pill's preferred timer. Used to give the
   * dashboard instant feedback while the user is still on the detail screen;
   * the actual Supabase/cache write happens separately (on detail-screen unmount).
   */
  setPillPreferredTimerLocal: (pillId: string, timerType: TimerType) => void;

  // Doses
  recordDose: (
    userId: string,
    pill: Pick<
      Pill,
      | 'id'
      | 'drugName'
      | 'halfLifeMinutes'
      | 'durationOfActionMinutes'
      | 'durationType'
      | 'isMaintenanceInterval'
      | 'requiresWeeklyWarning'
    >,
    takenAt: Date,
    source: DoseSource,
    scheduledFor?: Date | null,
  ) => Promise<string>;
  dismissDose: (userId: string, doseId: string) => Promise<void>;

  /**
   * Walk every active scheduled pill and write auto doses for every missed
   * scheduled occurrence since the per-pill anchor
   * (`max(autoAssumeTakenEnabledAt, pill.createdAt)`). Used by the
   * autoAssumeTaken setting — runs on dashboard mount and on AppState
   * foreground transitions. No-op for `every_n_days` schedules (no stored
   * cycle anchor, see `missedScheduledDoses`).
   */
  reconcileAutoAssumedDoses: (userId: string) => Promise<void>;

  /**
   * Local-only: drop active doses whose eliminationAt has passed. Lets the
   * dashboard stop showing one-time pills the instant their timer completes
   * without waiting for a Supabase round-trip.
   */
  pruneExpiredDoses: () => void;

  /**
   * Hard-delete every "one-time tracking" (random) pill that no longer has an
   * active dose. Random pills are meant to be ephemeral: tracking ends → row
   * is gone. Called on cold start (after init applies cached data and after
   * the Supabase sync lands) and on AppState foreground transitions.
   */
  cleanupOrphanedRandomPills: (userId: string) => Promise<void>;
}

// Module-level reentrancy guard for `reconcileAutoAssumedDoses`. Cold-start
// `init` and the AppState foreground listener can both fire within
// milliseconds; without the guard they'd race and double-insert.
let reconcileInProgress: string | null = null;

function applyDashboard(set: (partial: Partial<PillState>) => void, data: DashboardDocument) {
  const now = Date.now();
  set({
    pills: data.pills.filter((p) => p.isActive),
    activeDoses: data.activeDoses.filter(
      (d) => d.status === 'active' && d.eliminationAt.getTime() > now,
    ),
  });
}

export const usePillStore = create<PillState>((set, get) => ({
  pills: [],
  activeDoses: [],
  isLoading: true,

  init: async (userId: string) => {
    set({ isLoading: true });

    // Ensure the dashboard document exists
    await initializeDashboardIfNeeded(userId);

    // Load from cache (instant), then sync from Supabase in background.
    // The sync callback also re-runs the orphan cleanup so any random pill
    // that finished while the app was closed gets wiped once the canonical
    // server state lands.
    const cached = await loadDashboard(userId, (synced) => {
      applyDashboard(set, synced);
      get().cleanupOrphanedRandomPills(userId).catch(() => {});
    });

    applyDashboard(set, cached);
    set({ isLoading: false });

    // Cold-start sweep based on cached data. Runs immediately so the user
    // doesn't see stale "one-time tracking" pills flash on the dashboard
    // while the Supabase sync is still in flight.
    get().cleanupOrphanedRandomPills(userId).catch(() => {});
    // Auto-assume reconcile is a no-op when the setting is off; safe to
    // always invoke. Catches doses that "should have happened" while the
    // app was closed for users who opted in.
    get().reconcileAutoAssumedDoses(userId).catch(() => {});
  },

  reset: () => {
    set({ pills: [], activeDoses: [], isLoading: true });
  },

  addPill: async (userId, pill) => {
    const { id, dashboard } = await fbAddPill(userId, pill);
    applyDashboard(set, dashboard);
    return id;
  },

  updatePill: async (userId, pillId, data) => {
    const dashboard = await fbUpdatePill(userId, pillId, data);
    applyDashboard(set, dashboard);
  },

  setPillPreferredTimerLocal: (pillId, timerType) => {
    set((state) => ({
      pills: state.pills.map((p) =>
        p.id === pillId ? { ...p, preferredTimer: timerType } : p,
      ),
    }));
  },

  deletePill: async (userId, pillId) => {
    // Cancel scheduled notifications for this pill before deleting
    await cancelPillReminders(pillId).catch(() => {});
    const dashboard = await fbDeletePill(userId, pillId);
    applyDashboard(set, dashboard);
  },

  hardDeletePill: async (userId, pillId) => {
    await cancelPillReminders(pillId).catch(() => {});
    const dashboard = await fbHardDeletePill(userId, pillId);
    applyDashboard(set, dashboard);
  },

  recordDose: async (userId, pill, takenAt, source, scheduledFor) => {
    const { id, dashboard } = await fbRecordDose(userId, pill, takenAt, source, scheduledFor);
    applyDashboard(set, dashboard);
    return id;
  },

  dismissDose: async (userId, doseId) => {
    const dashboard = await fbUpdateDoseStatus(userId, doseId, 'dismissed');
    applyDashboard(set, dashboard);
  },

  pruneExpiredDoses: () => {
    const now = Date.now();
    set((state) => {
      const stillActive = state.activeDoses.filter(
        (d) => d.status === 'active' && d.eliminationAt.getTime() > now,
      );
      if (stillActive.length === state.activeDoses.length) return state;
      return { ...state, activeDoses: stillActive };
    });
  },

  reconcileAutoAssumedDoses: async (userId: string) => {
    // Per-user reentrancy guard. Cold-start `init` and the AppState
    // foreground listener both call this, often within milliseconds of each
    // other. Without the guard, both passes fetch the same dose list, both
    // decide nothing is covered, and both insert duplicates.
    if (reconcileInProgress === userId) return;
    reconcileInProgress = userId;

    try {
      const settings = useAuthStore.getState().user?.settings;
      if (!settings?.autoAssumeTaken) return;

      const enabledAt = settings.autoAssumeTakenEnabledAt
        ? new Date(settings.autoAssumeTakenEnabledAt)
        : null;

      const { pills } = get();
      const now = new Date();

      // Per-pill anchor = max(autoAssumeTakenEnabledAt, pill.createdAt). The
      // first floor honors the setting's audit trail (don't backfill before
      // the user opted in). The second prevents auto-recording occurrences
      // that pre-date the pill's existence.
      interface PillTask {
        pill: Pill;
        anchor: Date;
        candidates: Date[];
      }
      const tasks: PillTask[] = [];

      for (const pill of pills) {
        if (pill.pillType !== 'scheduled' || !pill.isActive || !pill.schedule) continue;

        const anchorMs = Math.max(
          pill.createdAt.getTime(),
          enabledAt?.getTime() ?? 0,
        );
        const anchor = new Date(anchorMs);
        if (anchor.getTime() >= now.getTime()) continue;

        const candidates = missedScheduledDoses(pill.schedule, anchor, now);
        if (candidates.length === 0) continue;

        tasks.push({ pill, anchor, candidates });
      }

      if (tasks.length === 0) return;

      // One batched fetch covering the union of all per-pill anchors. We
      // then filter per-pill in JS — saves N round trips for N pills.
      const earliestAnchor = new Date(
        Math.min(...tasks.map((t) => t.anchor.getTime())),
      );
      const existing = await fbFetchDosesSince(userId, earliestAnchor);

      const dosesByPill = new Map<string, Dose[]>();
      for (const dose of existing) {
        if (!dose.pillId) continue;
        const arr = dosesByPill.get(dose.pillId) ?? [];
        arr.push(dose);
        dosesByPill.set(dose.pillId, arr);
      }

      for (const { pill, candidates } of tasks) {
        const pillDoses = dosesByPill.get(pill.id) ?? [];

        for (const candidate of candidates) {
          const covered = pillDoses.some((d) => {
            // Exact scheduledFor match (every auto-record stamps this).
            if (
              d.scheduledFor &&
              Math.abs(d.scheduledFor.getTime() - candidate.getTime()) < 60_000
            ) {
              return true;
            }
            // ±30-min takenAt window covers manual records taken around the
            // scheduled time (which don't carry a scheduledFor today).
            return Math.abs(d.takenAt.getTime() - candidate.getTime()) < 30 * 60 * 1000;
          });
          if (covered) continue;

          try {
            const { dashboard } = await fbRecordDose(
              userId,
              pill,
              candidate,
              'auto',
              candidate,
            );
            applyDashboard(set, dashboard);
          } catch {
            // WAL retains the operation; next session will replay.
          }
        }
      }
    } finally {
      reconcileInProgress = null;
    }
  },

  cleanupOrphanedRandomPills: async (userId: string) => {
    const { pills, activeDoses } = get();
    const now = Date.now();
    const orphaned = pills.filter((p) => {
      if (p.pillType !== 'random' || !p.isActive) return false;
      return !activeDoses.some(
        (d) =>
          d.pillId === p.id &&
          d.status === 'active' &&
          d.eliminationAt.getTime() > now,
      );
    });
    if (orphaned.length === 0) return;
    // Sequential — each fbHardDeletePill reads the dashboard cache, mutates,
    // and writes a new copy. Parallel calls would let later writes clobber
    // earlier ones and resurrect deleted pills in the cache.
    for (const p of orphaned) {
      await cancelPillReminders(p.id).catch(() => {});
      try {
        const dashboard = await fbHardDeletePill(userId, p.id);
        applyDashboard(set, dashboard);
      } catch {
        // WAL retains the operation; next session will replay.
      }
    }
  },
}));
