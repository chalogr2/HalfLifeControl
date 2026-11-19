/**
 * Subscription service — wraps RevenueCat.
 *
 * RevenueCat handles all App Store / Play Store receipt validation,
 * entitlement management, and cross-platform subscription state.
 *
 * When RevenueCat API keys are not configured (empty env vars),
 * the service gracefully degrades to free tier with no errors.
 */
import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';
import type { SubscriptionTier } from '@/core/types';

export type ProPlan = 'monthly' | 'annual' | 'lifetime';

/** What RevenueCat says about the Pro entitlement right now. */
export interface ProStatus {
  active: boolean;
  /** null when inactive, or when the product can't be classified. */
  plan: ProPlan | null;
  /** End of the current paid period; null for lifetime (never expires). */
  expiresAt: Date | null;
  /** False once the user has cancelled in the store (access runs to expiresAt). */
  willRenew: boolean;
  /** Store page where the user manages / cancels the subscription. */
  managementURL: string | null;
}

const INACTIVE: ProStatus = {
  active: false,
  plan: null,
  expiresAt: null,
  willRenew: false,
  managementURL: null,
};

const APPLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY ?? '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';
// Must match the Entitlement identifier configured in the RevenueCat
// dashboard. RevenueCat entitlement identifiers are immutable once created,
// so any change here would require creating a new entitlement and
// re-associating all products in the dashboard.
const ENTITLEMENT_ID = 'HalfLifeControl Pro';

let initialized = false;

/**
 * RevenueCat Test Store keys start with `test_`. Test Store purchases are
 * simulated — they never touch Google Play / the App Store, so there is no
 * store page to cancel them from. The app simulates cancellation instead
 * (see useSubscriptionStore).
 */
export function isTestStore(): boolean {
  const key = Platform.OS === 'ios' ? APPLE_KEY : ANDROID_KEY;
  return key.startsWith('test_');
}

/** Initialize RevenueCat for a specific user. Re-initializes on user switch. */
export async function initSubscriptions(userId: string): Promise<void> {
  const apiKey = Platform.OS === 'ios' ? APPLE_KEY : ANDROID_KEY;
  if (!apiKey) return; // No key configured — skip initialization

  if (!initialized) {
    Purchases.setLogLevel(LOG_LEVEL.ERROR);
    await Purchases.configure({ apiKey, appUserID: userId });
    initialized = true;
  } else {
    // Already configured — switch to new user identity
    await Purchases.logIn(userId);
  }
}

/** Reset RevenueCat state on sign-out. */
export async function resetSubscriptions(): Promise<void> {
  if (!initialized) return;
  try {
    await Purchases.logOut();
  } catch {
    // logOut throws if already anonymous — safe to ignore
  }
}

/** Current Pro entitlement details. Inactive when RevenueCat isn't configured. */
export async function getProStatus(): Promise<ProStatus> {
  if (!initialized) return INACTIVE;

  try {
    return toProStatus(await Purchases.getCustomerInfo());
  } catch {
    return INACTIVE;
  }
}

/** Check if the user has an active Pro subscription. */
export async function getSubscriptionTier(): Promise<SubscriptionTier> {
  return (await getProStatus()).active ? 'pro' : 'free';
}

/** Get available packages for the paywall. */
export async function getOfferings(): Promise<PurchasesPackage[]> {
  if (!initialized) return [];

  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch {
    return [];
  }
}

/** Purchase a package. Returns the resulting Pro status. */
export async function purchasePackage(pkg: PurchasesPackage): Promise<ProStatus> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return toProStatus(customerInfo);
}

/** Restore previous purchases. Returns the restored Pro status. */
export async function restorePurchases(): Promise<ProStatus> {
  if (!initialized) return INACTIVE;

  try {
    return toProStatus(await Purchases.restorePurchases());
  } catch {
    return INACTIVE;
  }
}

/** Listen for subscription changes. */
export function onSubscriptionChange(
  callback: (status: ProStatus) => void,
): () => void {
  if (!initialized) return () => {};

  const listener = (info: CustomerInfo) => {
    callback(toProStatus(info));
  };

  Purchases.addCustomerInfoUpdateListener(listener);
  return () => Purchases.removeCustomerInfoUpdateListener(listener);
}

function toProStatus(info: CustomerInfo): ProStatus {
  const ent = info.entitlements.active[ENTITLEMENT_ID];
  if (!ent) return INACTIVE;
  const expiresAt = ent.expirationDate ? new Date(ent.expirationDate) : null;
  return {
    active: true,
    plan: classifyPlan(ent.productIdentifier, expiresAt),
    expiresAt,
    willRenew: ent.willRenew,
    managementURL: info.managementURL ?? null,
  };
}

/**
 * Lifetime = an entitlement with no expiration (a one-time, non-consumable
 * purchase). Otherwise infer the period from the product id — Play ids look
 * like `pro_annual:annual-base`, App Store ids like `pro.annual`.
 */
function classifyPlan(productId: string, expiresAt: Date | null): ProPlan | null {
  if (!expiresAt) return 'lifetime';
  const id = productId.toLowerCase();
  if (/(annual|year|yearly|12m|p1y)/.test(id)) return 'annual';
  if (/(month|monthly|1m|p1m)/.test(id)) return 'monthly';
  return null;
}
