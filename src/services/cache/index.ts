/**
 * Local cache + write-ahead log using AsyncStorage.
 *
 * Cache-first strategy: the app reads from cache instantly on launch,
 * then syncs from Firestore in the background. Writes update the cache
 * immediately before pushing to Firestore.
 *
 * Write-ahead log (WAL): every Firestore write is persisted to AsyncStorage
 * BEFORE the network call. If the write succeeds, the entry is removed.
 * If the app is killed or loses connection, pending writes survive and are
 * retried on next app open. This gives us native-SDK-level reliability
 * with the JS SDK.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  dashboard: (uid: string) => `@hlc:dashboard:${uid}`,
  history: (uid: string, month: string) => `@hlc:history:${uid}:${month}`,
  lastSync: (uid: string) => `@hlc:lastSync:${uid}`,
  writeQueue: (uid: string) => `@hlc:writeQueue:${uid}`,
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

// ─── Write-Ahead Log (WAL) ──────────────────────────
//
// Each entry represents a pending Firestore operation that must eventually
// succeed. The entry is persisted BEFORE the network call and removed
// only after Firestore confirms the write.
//
// Operations are atomic and commutative — order doesn't matter,
// replaying the same operation twice is safe (idempotent or harmless).
// This enables multi-device support: each device's WAL is independent.

export type WriteOperation =
  | { op: 'addPill'; pill: string }
  | { op: 'addDose'; dose: string }
  | { op: 'addHistoryDose'; month: string; dose: string }
  | { op: 'updatePill'; pillId: string; data: string }
  | { op: 'deletePill'; pillId: string }
  | { op: 'removeDose'; doseId: string };

export interface WriteQueueEntry {
  id: string;
  operation: WriteOperation;
  createdAt: number;
}

export async function getWriteQueue(uid: string): Promise<WriteQueueEntry[]> {
  const json = await AsyncStorage.getItem(KEYS.writeQueue(uid));
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

export async function enqueueWrite(uid: string, entry: WriteQueueEntry): Promise<void> {
  const queue = await getWriteQueue(uid);
  // No deduplication — each operation is independent and must be replayed
  queue.push(entry);
  await AsyncStorage.setItem(KEYS.writeQueue(uid), JSON.stringify(queue));
}

export async function dequeueWrite(uid: string, entryId: string): Promise<void> {
  const queue = await getWriteQueue(uid);
  const filtered = queue.filter((e) => e.id !== entryId);
  await AsyncStorage.setItem(KEYS.writeQueue(uid), JSON.stringify(filtered));
}

export async function hasPendingWrites(uid: string): Promise<boolean> {
  const queue = await getWriteQueue(uid);
  return queue.length > 0;
}

// ─── Clear on Sign-Out ──────────────────────────────

export async function clearUserCache(uid: string): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const userKeys = allKeys.filter((k) => k.includes(uid));
  if (userKeys.length > 0) {
    await AsyncStorage.multiRemove(userKeys);
  }
}
