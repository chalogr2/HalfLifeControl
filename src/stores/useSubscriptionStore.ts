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
import { updateSubscriptionTier } from '@/services/supabase/auth';
import { captureException } from '@/services/sentry';
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
let currentUserId: string | null = null;

/**
 * Sync tier change to Supabase so the profile row stays current.
 * Fire-and-forget — don't block the UI on this write.
 */
function syncTierToBackend(uid: string, tier: SubscriptionTier): void {
  updateSubscriptionTier(uid, tier).catch(captureException);
}

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

    currentUserId = userId;
    set({ isLoading: true });
    try {
      await initSubscriptions(userId);
      const [tier, packages] = await Promise.all([
        getSubscriptionTier(),
        getOfferings(),
      ]);
      set({ tier, packages, isLoading: false });

      // Sync initial tier to Firestore
      syncTierToBackend(userId, tier);

      // Listen for future changes (single listener, cleaned up on reset)
      cleanupListener = onSubscriptionChange((newTier) => {
        set({ tier: newTier });
        if (currentUserId) syncTierToBackend(currentUserId, newTier);
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
    currentUserId = null;
    resetSubscriptions();
    set({ tier: 'free', packages: [], isLoading: true });
  },

  purchase: async (pkg: PurchasesPackage) => {
    const tier = await purchasePackage(pkg);
    set({ tier });
    if (currentUserId) syncTierToBackend(currentUserId, tier);
  },

  restore: async () => {
    set({ isLoading: true });
    try {
      const tier = await restorePurchases();
      set({ tier, isLoading: false });
      if (currentUserId) syncTierToBackend(currentUserId, tier);
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
