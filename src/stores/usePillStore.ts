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
  initializeDashboardIfNeeded,
} from '@/services/supabase/pills';
import { cancelPillReminders } from '@/services/notifications';

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
  ) => Promise<string>;
  dismissDose: (userId: string, doseId: string) => Promise<void>;

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

  recordDose: async (userId, pill, takenAt, source) => {
    const { id, dashboard } = await fbRecordDose(userId, pill, takenAt, source);
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
