import { create } from 'zustand';
import type { SubscriptionTier } from '@/core/types';
import {
  initSubscriptions,
  getSubscriptionTier,
  getOfferings,
  purchasePackage,
  restorePurchases,
  onSubscriptionChange,
} from '@/services/subscription';
import type { PurchasesPackage } from 'react-native-purchases';

/** Max scheduled pills on free tier. */
export const FREE_SCHEDULED_LIMIT = 1;

interface SubscriptionState {
  tier: SubscriptionTier;
  packages: PurchasesPackage[];
  isLoading: boolean;

  /** Initialize RevenueCat and fetch current tier + offerings. */
  init: (userId: string) => Promise<void>;
  /** Purchase a package from the paywall. */
  purchase: (pkg: PurchasesPackage) => Promise<void>;
  /** Restore previous purchases. */
  restore: () => Promise<void>;
  /** Check if the user can add another scheduled pill. */
  canAddScheduledPill: (currentScheduledCount: number) => boolean;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  tier: 'free',
  packages: [],
  isLoading: true,

  init: async (userId: string) => {
    set({ isLoading: true });
    try {
      await initSubscriptions(userId);
      const [tier, packages] = await Promise.all([
        getSubscriptionTier(),
        getOfferings(),
      ]);
      set({ tier, packages, isLoading: false });

      // Listen for future changes
      onSubscriptionChange((newTier) => set({ tier: newTier }));
    } catch {
      set({ tier: 'free', packages: [], isLoading: false });
    }
  },

  purchase: async (pkg: PurchasesPackage) => {
    const tier = await purchasePackage(pkg);
    set({ tier });
  },

  restore: async () => {
    set({ isLoading: true });
    try {
      const tier = await restorePurchases();
      set({ tier, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  canAddScheduledPill: (currentScheduledCount: number) => {
    const { tier } = get();
    if (tier === 'pro') return true;
    return currentScheduledCount < FREE_SCHEDULED_LIMIT;
  },
}));
