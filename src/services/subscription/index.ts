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

const APPLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY ?? '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';
const ENTITLEMENT_ID = 'pro';

let initialized = false;

/** Initialize RevenueCat. Call once at app startup. */
export async function initSubscriptions(userId: string): Promise<void> {
  const apiKey = Platform.OS === 'ios' ? APPLE_KEY : ANDROID_KEY;
  if (!apiKey) return; // No key configured — skip initialization

  if (initialized) return;

  Purchases.setLogLevel(LOG_LEVEL.ERROR);
  await Purchases.configure({ apiKey, appUserID: userId });
  initialized = true;
}

/** Check if the user has an active Pro subscription. */
export async function getSubscriptionTier(): Promise<SubscriptionTier> {
  if (!initialized) return 'free';

  try {
    const info = await Purchases.getCustomerInfo();
    return hasProEntitlement(info) ? 'pro' : 'free';
  } catch {
    return 'free';
  }
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

/** Purchase a package. Returns the new tier. */
export async function purchasePackage(pkg: PurchasesPackage): Promise<SubscriptionTier> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return hasProEntitlement(customerInfo) ? 'pro' : 'free';
}

/** Restore previous purchases. Returns the restored tier. */
export async function restorePurchases(): Promise<SubscriptionTier> {
  if (!initialized) return 'free';

  try {
    const info = await Purchases.restorePurchases();
    return hasProEntitlement(info) ? 'pro' : 'free';
  } catch {
    return 'free';
  }
}

/** Listen for subscription changes. */
export function onSubscriptionChange(
  callback: (tier: SubscriptionTier) => void,
): () => void {
  if (!initialized) return () => {};

  const listener = (info: CustomerInfo) => {
    callback(hasProEntitlement(info) ? 'pro' : 'free');
  };

  Purchases.addCustomerInfoUpdateListener(listener);
  return () => Purchases.removeCustomerInfoUpdateListener(listener);
}

function hasProEntitlement(info: CustomerInfo): boolean {
  return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
}
