import { create } from 'zustand';
import type { Pill, Dose, DoseSource, DashboardDocument, TimerType } from '@/core/types';
import {
  loadDashboard,
  addPill as fbAddPill,
  updatePill as fbUpdatePill,
  deletePill as fbDeletePill,
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
}

function applyDashboard(set: (partial: Partial<PillState>) => void, data: DashboardDocument) {
  set({
    pills: data.pills.filter((p) => p.isActive),
    activeDoses: data.activeDoses,
  });
}

export const usePillStore = create<PillState>((set) => ({
  pills: [],
  activeDoses: [],
  isLoading: true,

  init: async (userId: string) => {
    set({ isLoading: true });

    // Ensure the dashboard document exists
    await initializeDashboardIfNeeded(userId);

    // Load from cache (instant), then sync from Firestore in background
    const cached = await loadDashboard(userId, (synced) => {
      // Background sync callback — update store with fresh Firestore data
      applyDashboard(set, synced);
    });

    applyDashboard(set, cached);
    set({ isLoading: false });
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

  recordDose: async (userId, pill, takenAt, source) => {
    const { id, dashboard } = await fbRecordDose(userId, pill, takenAt, source);
    applyDashboard(set, dashboard);
    return id;
  },

  dismissDose: async (userId, doseId) => {
    const dashboard = await fbUpdateDoseStatus(userId, doseId, 'dismissed');
    applyDashboard(set, dashboard);
  },
}));
