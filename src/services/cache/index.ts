/**
 * Local cache layer using AsyncStorage.
 *
 * Cache-first strategy: the app reads from cache instantly on launch,
 * then syncs from Firestore in the background. Writes update the cache
 * immediately before (or in parallel with) pushing to Firestore.
 *
 * This eliminates real-time listeners and reduces Firestore reads to
 * ~1-2 per app open instead of hundreds.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  dashboard: (uid: string) => `@hlc:dashboard:${uid}`,
  history: (uid: string, month: string) => `@hlc:history:${uid}:${month}`,
  lastSync: (uid: string) => `@hlc:lastSync:${uid}`,
};

// ─── Dashboard Cache ────────────────────────────────

export async function getCachedDashboard(uid: string): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.dashboard(uid));
}

export async function setCachedDashboard(uid: string, json: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.dashboard(uid), json);
}

// ─── History Cache ──────────────────────────────────

export async function getCachedHistory(uid: string, month: string): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.history(uid, month));
}

export async function setCachedHistory(uid: string, month: string, json: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.history(uid, month), json);
}

// ─── Sync Metadata ──────────────────────────────────

export async function getLastSyncTime(uid: string): Promise<number> {
  const val = await AsyncStorage.getItem(KEYS.lastSync(uid));
  return val ? Number(val) : 0;
}

export async function setLastSyncTime(uid: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.lastSync(uid), String(Date.now()));
}

// ─── Clear on Sign-Out ──────────────────────────────

export async function clearUserCache(uid: string): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const userKeys = allKeys.filter((k) => k.includes(uid));
  if (userKeys.length > 0) {
    await AsyncStorage.multiRemove(userKeys);
  }
}
