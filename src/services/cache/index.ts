/**
 * Local cache + write-ahead log using encrypted AsyncStorage.
 *
 * Cache-first strategy: the app reads from cache instantly on launch,
 * then syncs from Supabase in the background. Writes update the cache
 * immediately before pushing to Supabase.
 *
 * Write-ahead log (WAL): every Supabase write is persisted to AsyncStorage
 * BEFORE the network call. If the write succeeds, the entry is removed.
 * If the app is killed or loses connection, pending writes survive and are
 * retried on next app open. This gives us native-SDK-level reliability
 * with the JS SDK.
 *
 * HIPAA encryption:
 *   All PHI (medication data) is AES-256-GCM encrypted before writing to
 *   AsyncStorage via the shared `secureStorage` module. Non-PHI metadata
 *   (lastSync timestamp) is stored in plaintext.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureGet, secureSet } from '@/services/secureStorage';

const KEYS = {
  dashboard: (uid: string) => `@hlc:dashboard:${uid}`,
  history: (uid: string, month: string) => `@hlc:history:${uid}:${month}`,
  lastSync: (uid: string) => `@hlc:lastSync:${uid}`,
  writeQueue: (uid: string) => `@hlc:writeQueue:${uid}`,
};

// ─── Dashboard Cache ────────────────────────────────

export async function getCachedDashboard(uid: string): Promise<string | null> {
  return secureGet(KEYS.dashboard(uid));
}

export async function setCachedDashboard(uid: string, json: string): Promise<void> {
  await secureSet(KEYS.dashboard(uid), json);
}

// ─── History Cache ──────────────────────────────────

export async function getCachedHistory(uid: string, month: string): Promise<string | null> {
  return secureGet(KEYS.history(uid, month));
}

export async function setCachedHistory(uid: string, month: string, json: string): Promise<void> {
  await secureSet(KEYS.history(uid, month), json);
}

// ─── Sync Metadata (non-PHI, no encryption needed) ──

export async function getLastSyncTime(uid: string): Promise<number> {
  const val = await AsyncStorage.getItem(KEYS.lastSync(uid));
  return val ? Number(val) : 0;
}

export async function setLastSyncTime(uid: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.lastSync(uid), String(Date.now()));
}

// ─── Write-Ahead Log (WAL) ──────────────────────────
//
// Each entry represents a pending Supabase operation that must eventually
// succeed. The entry is persisted BEFORE the network call and removed
// only after Supabase confirms the write.
//
// Operations are atomic and commutative — order doesn't matter,
// replaying the same operation twice is safe (idempotent or harmless).
// This enables multi-device support: each device's WAL is independent.
//
// WAL data is encrypted because it contains serialized pill/dose payloads.

export type WriteOperation =
  | { op: 'addPill'; pill: string }
  | { op: 'addDose'; dose: string }
  | { op: 'addHistoryDose'; month: string; dose: string }
  | { op: 'updatePill'; pillId: string; data: string }
  | { op: 'deletePill'; pillId: string }
  | { op: 'hardDeletePill'; pillId: string }
  | { op: 'removeDose'; doseId: string }
  | { op: 'updateHistoryDoseStatus'; month: string; doseId: string; status: string };

export interface WriteQueueEntry {
  id: string;
  operation: WriteOperation;
  createdAt: number;
}

export async function getWriteQueue(uid: string): Promise<WriteQueueEntry[]> {
  const json = await secureGet(KEYS.writeQueue(uid));
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

export async function enqueueWrite(uid: string, entry: WriteQueueEntry): Promise<void> {
  const queue = await getWriteQueue(uid);
  queue.push(entry);
  await secureSet(KEYS.writeQueue(uid), JSON.stringify(queue));
}

/**
 * Enqueue multiple entries in a single AsyncStorage write.
 * This is atomic at the storage level — a kill between entries is impossible
 * because all entries are written in one setItem call.
 */
export async function enqueueWriteBatch(uid: string, entries: WriteQueueEntry[]): Promise<void> {
  const queue = await getWriteQueue(uid);
  queue.push(...entries);
  await secureSet(KEYS.writeQueue(uid), JSON.stringify(queue));
}

export async function dequeueWrite(uid: string, entryId: string): Promise<void> {
  const queue = await getWriteQueue(uid);
  const filtered = queue.filter((e) => e.id !== entryId);
  await secureSet(KEYS.writeQueue(uid), JSON.stringify(filtered));
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
  // Note: we do NOT delete the encryption key from SecureStore on sign-out.
  // The key is device-scoped (not user-scoped), so it persists across accounts.
  // Clearing AsyncStorage is sufficient — the ciphertext is gone.
}
