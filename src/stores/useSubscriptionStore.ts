import { create } from 'zustand';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SubscriptionTier } from '@/core/types';
import {
  initSubscriptions,
  getProStatus,
  getOfferings,
  purchasePackage,
  restorePurchases,
  onSubscriptionChange,
  resetSubscriptions,
  isTestStore,
  type ProStatus,
} from '@/services/subscription';
import type { PurchasesPackage } from 'react-native-purchases';

/** Free tier limits (from GAMEPLAN spec). */
export const FREE_SCHEDULED_LIMIT = 1;
export const FREE_RANDOM_LIMIT = 4;

/** Google Play's subscription page, used when RevenueCat gives no managementURL. */
const PLAY_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions';

/**
 * Simulated cancellation (Test Store only). Test Store purchases can't be
 * cancelled — they auto-renew on an accelerated clock — so "Unsubscribe"
 * records when access should end, mirroring a real store cancel: Pro stays
 * until the end of the period that was paid for, then the account drops to
 * Free even though RevenueCat keeps renewing the fake subscription.
 */
interface SimulatedCancel {
  accessUntil: string; // ISO
}

interface SubscriptionState {
  tier: SubscriptionTier;
  /** Raw RevenueCat entitlement details (plan, expiry, renewal). */
  status: ProStatus | null;
  /** Set while a simulated (Test Store) cancellation is in effect. */
  cancelledUntil: Date | null;
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
  /** Re-fetch the current tier from RevenueCat (e.g. on app foreground). */
  refreshTier: () => Promise<void>;
  /**
   * Cancel Pro. Lifetime purchases can't be cancelled (nothing renews and
   * nothing is refunded). Test Store: simulated, access runs to the end of
   * the current period. Real store: opens the store's subscription page,
   * since only the store can cancel a subscription.
   */
  unsubscribe: () => Promise<'simulated' | 'opened-store'>;
  /** Undo a simulated cancellation while access is still running. */
  resumeSubscription: () => Promise<void>;
  /** Check if the user can add another scheduled pill. */
  canAddScheduledPill: (currentScheduledCount: number) => boolean;
  /** Check if the user can track another random pill simultaneously. */
  canAddRandomPill: (currentRandomCount: number) => boolean;
}

let cleanupListener: (() => void) | null = null;
let currentUserId: string | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

const cancelKey = (uid: string) => `hlc:sim-cancel:${uid}`;

async function readCancel(uid: string): Promise<Date | null> {
  try {
    const raw = await AsyncStorage.getItem(cancelKey(uid));
    if (!raw) return null;
    const d = new Date((JSON.parse(raw) as SimulatedCancel).accessUntil);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

async function writeCancel(uid: string, until: Date | null): Promise<void> {
  try {
    if (until) {
      const value: SimulatedCancel = { accessUntil: until.toISOString() };
      await AsyncStorage.setItem(cancelKey(uid), JSON.stringify(value));
    } else {
      await AsyncStorage.removeItem(cancelKey(uid));
    }
  } catch {
    // Best effort — worst case the simulated cancel doesn't survive a restart.
  }
}

/** Pro while RevenueCat reports the entitlement, unless a simulated cancel has run out. */
function effectiveTier(status: ProStatus | null, cancelledUntil: Date | null): SubscriptionTier {
  if (!status?.active) return 'free';
  if (status.plan === 'lifetime') return 'pro';
  if (cancelledUntil && Date.now() >= cancelledUntil.getTime()) return 'free';
  return 'pro';
}

// RevenueCat is the in-app source of truth for the user's tier. The
// `profiles.subscription_tier` column is written exclusively by the
// `revenuecat-webhook` Edge Function (Stage 2) and read by server-side
// gates -- the client no longer writes to it from anywhere. See
// migration 0005 for the column-level RLS lock that enforces this.

export const useSubscriptionStore = create<SubscriptionState>((set, get) => {
  /** Recompute tier and arm a timer for the moment a simulated cancel expires. */
  function apply(status: ProStatus | null, cancelledUntil: Date | null) {
    if (expiryTimer) {
      clearTimeout(expiryTimer);
      expiryTimer = null;
    }
    set({ status, cancelledUntil, tier: effectiveTier(status, cancelledUntil) });
    if (cancelledUntil) {
      const delay = cancelledUntil.getTime() - Date.now();
      // setTimeout overflows past ~24.8 days; the foreground refresh covers longer.
      if (delay > 0 && delay < 2_147_000_000) {
        expiryTimer = setTimeout(() => {
          const s = get();
          set({ tier: effectiveTier(s.status, s.cancelledUntil) });
        }, delay + 500);
      }
    }
  }

  return {
    tier: 'free',
    status: null,
    cancelledUntil: null,
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
        const [status, packages, cancelledUntil] = await Promise.all([
          getProStatus(),
          getOfferings(),
          readCancel(userId),
        ]);
        set({ packages, isLoading: false });
        apply(status, cancelledUntil);

        // Listen for future changes (single listener, cleaned up on reset)
        cleanupListener = onSubscriptionChange((next) => {
          apply(next, get().cancelledUntil);
        });
      } catch {
        set({ packages: [], isLoading: false });
        apply(null, null);
      }
    },

    reset: () => {
      if (cleanupListener) {
        cleanupListener();
        cleanupListener = null;
      }
      currentUserId = null;
      resetSubscriptions();
      apply(null, null);
      set({ packages: [], isLoading: true });
    },

    purchase: async (pkg: PurchasesPackage) => {
      const status = await purchasePackage(pkg);
      // A fresh purchase supersedes any earlier simulated cancellation.
      if (currentUserId) await writeCancel(currentUserId, null);
      apply(status, null);
    },

    restore: async () => {
      set({ isLoading: true });
      try {
        const status = await restorePurchases();
        set({ isLoading: false });
        apply(status, get().cancelledUntil);
      } catch {
        set({ isLoading: false });
      }
    },

    // Pulls the latest status from RevenueCat. The customer-info listener
    // (set up in init) already catches changes while the app is open, but a
    // foreground refresh covers cases the listener can miss -- e.g. a tier
    // change that happened on another device or via the webhook while this
    // app was fully backgrounded. getProStatus reads RevenueCat's
    // locally-cached CustomerInfo, so it returns the last-known entitlement
    // even offline (it only reports inactive when RC isn't configured).
    refreshTier: async () => {
      apply(await getProStatus(), get().cancelledUntil);
    },

    unsubscribe: async () => {
      const { status } = get();
      if (!status?.active || status.plan === 'lifetime') {
        throw new Error('There is no renewing subscription to cancel.');
      }
      if (isTestStore()) {
        // End of the paid period; fall back to "now" if RC gave no date.
        const until = status.expiresAt ?? new Date();
        if (currentUserId) await writeCancel(currentUserId, until);
        apply(status, until);
        return 'simulated';
      }
      await Linking.openURL(status.managementURL ?? PLAY_SUBSCRIPTIONS_URL);
      return 'opened-store';
    },

    resumeSubscription: async () => {
      if (currentUserId) await writeCancel(currentUserId, null);
      apply(get().status, null);
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
  };
});
