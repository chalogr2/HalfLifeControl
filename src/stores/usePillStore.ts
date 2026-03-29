import { create } from 'zustand';
import type { Pill, Dose, DoseSource } from '@/core/types';
import {
  addPill as fbAddPill,
  updatePill as fbUpdatePill,
  deletePill as fbDeletePill,
  subscribePills,
  recordDose as fbRecordDose,
  updateDoseStatus as fbUpdateDoseStatus,
  subscribeActiveDoses,
} from '@/services/firebase/pills';
import type { Unsubscribe } from 'firebase/firestore';

interface PillState {
  pills: Pill[];
  activeDoses: Dose[];
  isLoading: boolean;

  // Subscription management
  subscribe: (userId: string) => void;
  unsubscribe: () => void;

  // Pills
  addPill: (userId: string, pill: Omit<Pill, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updatePill: (userId: string, pillId: string, data: Partial<Omit<Pill, 'id' | 'createdAt'>>) => Promise<void>;
  deletePill: (userId: string, pillId: string) => Promise<void>;

  // Doses
  recordDose: (
    userId: string,
    pill: Pick<Pill, 'id' | 'drugName' | 'halfLifeMinutes'>,
    takenAt: Date,
    source: DoseSource,
  ) => Promise<string>;
  dismissDose: (userId: string, doseId: string) => Promise<void>;
}

let unsubs: Unsubscribe[] = [];

export const usePillStore = create<PillState>((set) => ({
  pills: [],
  activeDoses: [],
  isLoading: true,

  subscribe: (userId: string) => {
    set({ isLoading: true });

    const unsubPills = subscribePills(userId, (pills) => {
      set({ pills, isLoading: false });
    });

    const unsubDoses = subscribeActiveDoses(userId, (activeDoses) => {
      set({ activeDoses });
    });

    unsubs = [unsubPills, unsubDoses];
  },

  unsubscribe: () => {
    unsubs.forEach((u) => u());
    unsubs = [];
    set({ pills: [], activeDoses: [], isLoading: true });
  },

  addPill: async (userId, pill) => {
    return fbAddPill(userId, pill);
  },

  updatePill: async (userId, pillId, data) => {
    await fbUpdatePill(userId, pillId, data);
  },

  deletePill: async (userId, pillId) => {
    await fbDeletePill(userId, pillId);
  },

  recordDose: async (userId, pill, takenAt, source) => {
    return fbRecordDose(userId, pill, takenAt, source);
  },

  dismissDose: async (userId, doseId) => {
    await fbUpdateDoseStatus(userId, doseId, 'dismissed');
  },
}));
