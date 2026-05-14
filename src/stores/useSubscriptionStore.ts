import { create } from 'zustand';
import type { SubscriptionTier } from '@/core/types';
import {
  initSubscriptions,
  getSubscriptionTier,
  getOfferings,
  purchasePackage,
  restorePurchases,
  onSubscriptionChange,
  resetSubscriptions,
} from '@/services/subscription';
import type { PurchasesPackage } from 'react-native-purchases';

/** Free tier limits (from GAMEPLAN spec). */
export const FREE_SCHEDULED_LIMIT = 1;
export const FREE_RANDOM_LIMIT = 4;

interface SubscriptionState {
  tier: SubscriptionTier;
  packages: PurchasesPackage[];
  isLoading: boolean;

  /** Initialize RevenueCat and fetch current tier + offerings. */
  init: (userId: string) => Promise<void>;
  /** Reset state on sign-out. Cleans up listener and RevenueCat identity. */
  reset: () => void;
  /** Purchase a package from the paywall. */
  purchase: (pkg: PurchasesPackage) => Promise<void>;
  /** Restore previous purchases. */
  restore: () => Promise<void>;
  /** Check if the user can add another scheduled pill. */
  canAddScheduledPill: (currentScheduledCount: number) => boolean;
  /** Check if the user can track another random pill simultaneously. */
  canAddRandomPill: (currentRandomCount: number) => boolean;
}

let cleanupListener: (() => void) | null = null;

// RevenueCat is the in-app source of truth for the user's tier. The
// `profiles.subscription_tier` column is written exclusively by the
// `revenuecat-webhook` Edge Function (Stage 2) and read by server-side
// gates -- the client no longer writes to it from anywhere. See
// migration 0005 for the column-level RLS lock that enforces this.

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  tier: 'free',
  packages: [],
  isLoading: true,

  init: async (userId: string) => {
    // Clean up previous listener if switching users
    if (cleanupListener) {
      cleanupListener();
      cleanupListener = null;
    }

    set({ isLoading: true });
    try {
      await initSubscriptions(userId);
      const [tier, packages] = await Promise.all([
        getSubscriptionTier(),
        getOfferings(),
      ]);
      set({ tier, packages, isLoading: false });

      // Listen for future changes (single listener, cleaned up on reset)
      cleanupListener = onSubscriptionChange((newTier) => {
        set({ tier: newTier });
      });
    } catch {
      set({ tier: 'free', packages: [], isLoading: false });
    }
  },

  reset: () => {
    if (cleanupListener) {
      cleanupListener();
      cleanupListener = null;
    }
    resetSubscriptions();
    set({ tier: 'free', packages: [], isLoading: true });
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

  canAddRandomPill: (currentRandomCount: number) => {
    const { tier } = get();
    if (tier === 'pro') return true;
    return currentRandomCount < FREE_RANDOM_LIMIT;
  },
}));
