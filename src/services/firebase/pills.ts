/**
 * Firestore CRUD — Optimized single-document + monthly bucketing.
 *
 * Schema:
 *   users/{uid}/data/dashboard   → all pills + active doses (1 read per app open)
 *   users/{uid}/history/{YYYY-MM} → all doses for a month (1 read per month)
 *
 * Write strategy (hybrid WAL — multi-device safe):
 *
 *   APPENDS (addPill, addDose, addHistoryDose) — 0 reads, 1 write:
 *     1. Update local cache
 *     2. Enqueue operation to WAL
 *     3. Attempt Firestore arrayUnion (atomic append, no read needed)
 *     4. On success → dequeue
 *
 *   MUTATIONS (updatePill, deletePill, removeDose) — 1 read, 1 write:
 *     1. Update local cache
 *     2. Enqueue operation to WAL
 *     3. Attempt Firestore runTransaction (read → merge → write)
 *     4. On success → dequeue
 *
 *   On failure (offline / app kill):
 *     Entry survives in WAL, retried on next app open via flushWriteQueue.
 *
 * Multi-device conflict resolution:
 *   - arrayUnion is commutative: Phone adds Aspirin + Watch adds Metformin → both survive
 *   - Transactions read-then-merge: concurrent edits don't overwrite each other
 *   - If pending WAL entries exist, local cache wins over stale remote data
 */
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  runTransaction,
} from 'firebase/firestore';
import { db } from './config';
import { eliminationDate } from '@/core/halflife';
import { captureException } from '@/services/sentry';
import {
  getCachedDashboard,
  setCachedDashboard,
  getCachedHistory,
  setCachedHistory,
  setLastSyncTime,
  enqueueWrite,
  dequeueWrite,
  getWriteQueue,
  hasPendingWrites,
  type WriteQueueEntry,
  type WriteOperation,
} from '@/services/cache';
import type {
  Pill,
  Dose,
  DoseSource,
  DashboardDocument,
  MonthlyHistoryDocument,
} from '@/core/types';
import { generateId } from '@/core/types';

// ─── Helpers ──────────────────────────────────────────

function dashboardRef(uid: string) {
  return doc(db, 'users', uid, 'data', 'dashboard');
}

function historyRef(uid: string, month: string) {
  return doc(db, 'users', uid, 'history', month);
}

function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function toDate(val: any): Date {
  if (val?.toDate) return val.toDate(); // Firestore Timestamp
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') return new Date(val);
  return new Date();
}

function serializeDashboard(data: DashboardDocument): string {
  return JSON.stringify({
    pills: data.pills.map(serializePill),
    activeDoses: data.activeDoses.map(serializeDose),
    updatedAt: data.updatedAt.toISOString(),
  });
}

function deserializeDashboard(json: string): DashboardDocument {
  const raw = JSON.parse(json);
  return {
    pills: (raw.pills ?? []).map(deserializePill),
    activeDoses: (raw.activeDoses ?? []).map(deserializeDose),
    updatedAt: new Date(raw.updatedAt),
  };
}

function serializePill(pill: Pill): Record<string, any> {
  return {
    ...pill,
    createdAt: pill.createdAt.toISOString(),
    updatedAt: pill.updatedAt.toISOString(),
  };
}

function deserializePill(raw: Record<string, any>): Pill {
  return {
    id: raw.id,
    drugName: raw.drugName,
    drugId: raw.drugId ?? '',
    halfLifeMinutes: raw.halfLifeMinutes,
    halfLifeSource: raw.halfLifeSource ?? 'manual',
    dosageMg: raw.dosageMg,
    dosageUnit: raw.dosageUnit ?? 'mg',
    pillType: raw.pillType,
    schedule: raw.schedule ?? null,
    color: raw.color ?? '#004d64',
    isActive: raw.isActive ?? true,
    createdAt: toDate(raw.createdAt),
    updatedAt: toDate(raw.updatedAt),
  };
}

function serializeDose(dose: Dose): Record<string, any> {
  return {
    ...dose,
    takenAt: dose.takenAt.toISOString(),
    scheduledFor: dose.scheduledFor?.toISOString() ?? null,
    eliminationAt: dose.eliminationAt.toISOString(),
    createdAt: dose.createdAt.toISOString(),
  };
}

function deserializeDose(raw: Record<string, any>): Dose {
  return {
    id: raw.id,
    pillId: raw.pillId,
    drugName: raw.drugName,
    takenAt: toDate(raw.takenAt),
    scheduledFor: raw.scheduledFor ? toDate(raw.scheduledFor) : null,
    halfLifeMinutes: raw.halfLifeMinutes,
    eliminationAt: toDate(raw.eliminationAt),
    status: raw.status,
    source: raw.source ?? 'manual',
    createdAt: toDate(raw.createdAt),
  };
}

function toFirestoreDashboard(data: DashboardDocument): Record<string, any> {
  return {
    pills: data.pills.map(serializePill),
    activeDoses: data.activeDoses.map(serializeDose),
    updatedAt: serverTimestamp(),
  };
}

function parseDashboardDoc(docData: Record<string, any>): DashboardDocument {
  return {
    pills: (docData.pills ?? []).map(deserializePill),
    activeDoses: (docData.activeDoses ?? []).map(deserializeDose),
    updatedAt: toDate(docData.updatedAt),
  };
}

function parseHistoryDoc(docData: Record<string, any>): MonthlyHistoryDocument {
  return {
    month: docData.month ?? '',
    doses: (docData.doses ?? []).map(deserializeDose),
    updatedAt: toDate(docData.updatedAt),
  };
}

// ─── Empty state ─────────────────────────────────────

function emptyDashboard(): DashboardDocument {
  return { pills: [], activeDoses: [], updatedAt: new Date() };
}

// ─── Dashboard: Load ─────────────────────────────────

/**
 * Load dashboard: cache first, flush pending writes, then Firestore sync.
 *
 * Flow:
 *   1. Return cached data instantly (0 reads)
 *   2. In background: flush any pending writes from WAL
 *   3. Then fetch fresh data from Firestore (1 read)
 *   4. Only overwrite cache if no pending writes remain
 */
export async function loadDashboard(
  uid: string,
  onSync?: (data: DashboardDocument) => void,
): Promise<DashboardDocument> {
  // 1. Try cache first (instant, no Firestore read)
  let cached: DashboardDocument | null = null;
  try {
    const json = await getCachedDashboard(uid);
    if (json) cached = deserializeDashboard(json);
  } catch {
    // Cache miss or corruption — continue to Firestore
  }

  // 2. Background: flush pending writes, then sync
  (async () => {
    try {
      // Flush any writes that failed during previous sessions
      await flushWriteQueue(uid);

      // Now fetch from Firestore (1 read)
      const remote = await fetchDashboardFromFirestore(uid);
      if (!remote) return;

      // Only apply remote data if no new pending writes accumulated during flush
      const stillPending = await hasPendingWrites(uid);
      if (stillPending) {
        // Local cache has newer data than remote — don't overwrite
        return;
      }

      // Clean up eliminated doses
      const now = new Date();
      remote.activeDoses = remote.activeDoses.filter(
        (d) => d.eliminationAt > now && d.status === 'active',
      );

      // Update cache with fresh remote data
      await setCachedDashboard(uid, serializeDashboard(remote));
      await setLastSyncTime(uid);

      // Notify caller with fresh data
      onSync?.(remote);
    } catch (err) {
      captureException(err);
    }
  })();

  return cached ?? emptyDashboard();
}

async function fetchDashboardFromFirestore(uid: string): Promise<DashboardDocument | null> {
  const snap = await getDoc(dashboardRef(uid));
  if (!snap.exists()) return null;
  return parseDashboardDoc(snap.data());
}

// ─── Write-Ahead Log: Flush ─────────────────────────

/**
 * Retry all pending operations from the WAL.
 * Called on app open before syncing from Firestore.
 *
 * Each operation is replayed using the same method as the original:
 *   - Appends → arrayUnion (0 reads)
 *   - Mutations → runTransaction (1 read)
 */
async function flushWriteQueue(uid: string): Promise<void> {
  const queue = await getWriteQueue(uid);
  if (queue.length === 0) return;

  for (const entry of queue) {
    try {
      // Skip legacy state-based entries from before the operations migration
      if (!entry.operation) {
        await dequeueWrite(uid, entry.id);
        continue;
      }
      await executeOperation(uid, entry.operation);
      await dequeueWrite(uid, entry.id);
    } catch {
      // Still offline or Firestore error — leave in queue for next retry
      // Don't throw — continue trying other entries
    }
  }
}

/**
 * Execute a single WAL operation against Firestore.
 * Appends use arrayUnion (0 reads), mutations use transactions (1 read).
 */
async function executeOperation(uid: string, operation: WriteOperation): Promise<void> {
  switch (operation.op) {
    case 'addPill': {
      const pill = JSON.parse(operation.pill);
      await updateDoc(dashboardRef(uid), {
        pills: arrayUnion(pill),
        updatedAt: serverTimestamp(),
      });
      break;
    }

    case 'addDose': {
      const dose = JSON.parse(operation.dose);
      await updateDoc(dashboardRef(uid), {
        activeDoses: arrayUnion(dose),
        updatedAt: serverTimestamp(),
      });
      break;
    }

    case 'addHistoryDose': {
      const dose = JSON.parse(operation.dose);
      // setDoc + merge creates the doc if it doesn't exist (new month)
      await setDoc(historyRef(uid, operation.month), {
        month: operation.month,
        doses: arrayUnion(dose),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      break;
    }

    case 'updatePill': {
      const partialData = JSON.parse(operation.data);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(dashboardRef(uid));
        if (!snap.exists()) return;
        const remote = parseDashboardDoc(snap.data());
        const idx = remote.pills.findIndex((p) => p.id === operation.pillId);
        if (idx === -1) return;
        remote.pills[idx] = {
          ...remote.pills[idx],
          ...partialData,
          updatedAt: new Date(),
        };
        remote.updatedAt = new Date();
        tx.set(dashboardRef(uid), toFirestoreDashboard(remote));
      });
      break;
    }

    case 'deletePill': {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(dashboardRef(uid));
        if (!snap.exists()) return;
        const remote = parseDashboardDoc(snap.data());
        const idx = remote.pills.findIndex((p) => p.id === operation.pillId);
        if (idx !== -1) {
          remote.pills[idx].isActive = false;
          remote.pills[idx].updatedAt = new Date();
        }
        remote.activeDoses = remote.activeDoses.filter(
          (d) => d.pillId !== operation.pillId,
        );
        remote.updatedAt = new Date();
        tx.set(dashboardRef(uid), toFirestoreDashboard(remote));
      });
      break;
    }

    case 'removeDose': {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(dashboardRef(uid));
        if (!snap.exists()) return;
        const remote = parseDashboardDoc(snap.data());
        remote.activeDoses = remote.activeDoses.filter(
          (d) => d.id !== operation.doseId,
        );
        remote.updatedAt = new Date();
        tx.set(dashboardRef(uid), toFirestoreDashboard(remote));
      });
      break;
    }
  }
}

// ─── WAL helper: enqueue + attempt ──────────────────

/**
 * Common pattern: enqueue operation → update cache → attempt Firestore write → dequeue on success.
 *
 * Order matters: WAL enqueue happens BEFORE cache update, so a crash between
 * the two can't leave optimistic local state without a corresponding WAL entry.
 * If we crash after enqueue but before cache, the WAL still syncs on next open
 * and the background Firestore fetch updates the cache.
 */
async function enqueueAndAttempt(
  uid: string,
  operation: WriteOperation,
): Promise<void> {
  const entryId = generateId();
  await enqueueWrite(uid, {
    id: entryId,
    operation,
    createdAt: Date.now(),
  });

  try {
    await executeOperation(uid, operation);
    await dequeueWrite(uid, entryId);
  } catch (error) {
    // Failed — entry stays in WAL, will be retried on next app open
    captureException(error);
  }
}

// ─── Pills CRUD ──────────────────────────────────────

export async function addPill(
  uid: string,
  pill: Omit<Pill, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<{ id: string; dashboard: DashboardDocument }> {
  const dashboard = await getCurrentDashboard(uid);
  const now = new Date();
  const newPill: Pill = {
    ...pill,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  dashboard.pills.push(newPill);
  dashboard.updatedAt = now;

  // WAL first (survives app kill), then cache
  await enqueueAndAttempt(uid, {
    op: 'addPill',
    pill: JSON.stringify(serializePill(newPill)),
  });
  await setCachedDashboard(uid, serializeDashboard(dashboard));

  return { id: newPill.id, dashboard };
}

export async function updatePill(
  uid: string,
  pillId: string,
  data: Partial<Omit<Pill, 'id' | 'createdAt'>>,
): Promise<DashboardDocument> {
  const dashboard = await getCurrentDashboard(uid);
  const idx = dashboard.pills.findIndex((p) => p.id === pillId);
  if (idx === -1) throw new Error('Pill not found');
  dashboard.pills[idx] = { ...dashboard.pills[idx], ...data, updatedAt: new Date() };
  dashboard.updatedAt = new Date();

  // WAL first, then cache
  const { updatedAt: _drop, ...walData } = data;
  await enqueueAndAttempt(uid, {
    op: 'updatePill',
    pillId,
    data: JSON.stringify(walData),
  });
  await setCachedDashboard(uid, serializeDashboard(dashboard));

  return dashboard;
}

export async function deletePill(uid: string, pillId: string): Promise<DashboardDocument> {
  const dashboard = await getCurrentDashboard(uid);
  // Soft delete: mark inactive to preserve history references
  const idx = dashboard.pills.findIndex((p) => p.id === pillId);
  if (idx !== -1) {
    dashboard.pills[idx].isActive = false;
    dashboard.pills[idx].updatedAt = new Date();
  }
  // Also remove any active doses for this pill
  dashboard.activeDoses = dashboard.activeDoses.filter((d) => d.pillId !== pillId);
  dashboard.updatedAt = new Date();

  // WAL first, then cache
  await enqueueAndAttempt(uid, { op: 'deletePill', pillId });
  await setCachedDashboard(uid, serializeDashboard(dashboard));

  return dashboard;
}

// ─── Doses ───────────────────────────────────────────

export async function recordDose(
  uid: string,
  pill: Pick<Pill, 'id' | 'drugName' | 'halfLifeMinutes'>,
  takenAt: Date,
  source: DoseSource,
  scheduledFor?: Date | null,
): Promise<{ id: string; dashboard: DashboardDocument }> {
  const dashboard = await getCurrentDashboard(uid);
  const now = new Date();
  const elimAt = eliminationDate(takenAt, pill.halfLifeMinutes);

  const newDose: Dose = {
    id: generateId(),
    pillId: pill.id,
    drugName: pill.drugName,
    takenAt,
    scheduledFor: scheduledFor ?? null,
    halfLifeMinutes: pill.halfLifeMinutes,
    eliminationAt: elimAt,
    status: 'active',
    source,
    createdAt: now,
  };

  // Add to active doses in dashboard
  dashboard.activeDoses.push(newDose);
  dashboard.updatedAt = now;

  const serializedDose = serializeDose(newDose);

  // WAL first (both dashboard + history), then cache
  await enqueueAndAttempt(uid, {
    op: 'addDose',
    dose: JSON.stringify(serializedDose),
  });
  await setCachedDashboard(uid, serializeDashboard(dashboard));

  // arrayUnion to monthly history: 0 reads, 1 write
  await appendToHistory(uid, newDose);

  return { id: newDose.id, dashboard };
}

export async function updateDoseStatus(
  uid: string,
  doseId: string,
  status: 'active' | 'dismissed' | 'completed',
): Promise<DashboardDocument> {
  const dashboard = await getCurrentDashboard(uid);
  const idx = dashboard.activeDoses.findIndex((d) => d.id === doseId);
  if (idx !== -1) {
    dashboard.activeDoses[idx].status = status;
    if (status !== 'active') {
      // Remove from active doses
      dashboard.activeDoses.splice(idx, 1);
    }
  }
  dashboard.updatedAt = new Date();

  // WAL first, then cache
  await enqueueAndAttempt(uid, { op: 'removeDose', doseId });
  await setCachedDashboard(uid, serializeDashboard(dashboard));

  return dashboard;
}

// ─── History ─────────────────────────────────────────

/**
 * Append a dose to the monthly history bucket.
 * Uses arrayUnion — 0 reads, 1 write, multi-device safe.
 * setDoc with merge creates the doc if the month doesn't exist yet.
 */
async function appendToHistory(uid: string, dose: Dose): Promise<void> {
  const month = toMonthKey(dose.takenAt);

  // WAL first, then cache
  await enqueueAndAttempt(uid, {
    op: 'addHistoryDose',
    month,
    dose: JSON.stringify(serializeDose(dose)),
  });

  // Update local cache after WAL is persisted.
  // Use cache-only read (no Firestore) — arrayUnion handles the remote append.
  // If cache is cold for this month, start with empty; the next background sync
  // will populate the full history.
  const history = await getCachedMonthHistory(uid, month);
  history.doses.push(dose);
  history.updatedAt = new Date();
  await setCachedHistory(uid, month, JSON.stringify({
    month: history.month,
    doses: history.doses.map(serializeDose),
    updatedAt: history.updatedAt.toISOString(),
  }));
}

/** Cache-only month history — no Firestore read. For use in write paths. */
async function getCachedMonthHistory(uid: string, month: string): Promise<MonthlyHistoryDocument> {
  try {
    const json = await getCachedHistory(uid, month);
    if (json) {
      const raw = JSON.parse(json);
      return {
        month: raw.month,
        doses: (raw.doses ?? []).map(deserializeDose),
        updatedAt: new Date(raw.updatedAt),
      };
    }
  } catch {
    // Cache miss
  }
  return { month, doses: [], updatedAt: new Date() };
}

async function getMonthHistory(uid: string, month: string): Promise<MonthlyHistoryDocument> {
  // Try cache first
  const cached = await getCachedMonthHistory(uid, month);
  if (cached.doses.length > 0) return cached;

  // Fetch from Firestore (1 read)
  const snap = await getDoc(historyRef(uid, month));
  if (snap.exists()) {
    const history = parseHistoryDoc(snap.data());
    // Cache it
    await setCachedHistory(uid, month, JSON.stringify({
      month: history.month,
      doses: history.doses.map(serializeDose),
      updatedAt: history.updatedAt.toISOString(),
    })).catch(() => {});
    return history;
  }

  return { month, doses: [], updatedAt: new Date() };
}

/**
 * Fetch dose history for a list of months.
 * Returns all doses sorted newest first.
 */
export async function fetchDoseHistory(
  uid: string,
  monthCount: number = 3,
): Promise<Dose[]> {
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < monthCount; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(toMonthKey(d));
  }

  const allDoses: Dose[] = [];
  for (const month of months) {
    const history = await getMonthHistory(uid, month);
    allDoses.push(...history.doses);
  }

  return allDoses.sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());
}

/**
 * Fetch all doses for a specific date range (for day detail view).
 */
export async function fetchDosesByDateRange(
  uid: string,
  startDate: Date,
  endDate: Date,
): Promise<Dose[]> {
  // Determine which months to load
  const months = new Set<string>();
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    months.add(toMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const allDoses: Dose[] = [];
  for (const month of months) {
    const history = await getMonthHistory(uid, month);
    allDoses.push(
      ...history.doses.filter(
        (d) => d.takenAt >= startDate && d.takenAt <= endDate,
      ),
    );
  }

  return allDoses.sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime());
}

// ─── Internal: get current dashboard from cache ──────

async function getCurrentDashboard(uid: string): Promise<DashboardDocument> {
  try {
    const json = await getCachedDashboard(uid);
    if (json) return deserializeDashboard(json);
  } catch {
    // Cache miss
  }
  // Fallback to Firestore
  const remote = await fetchDashboardFromFirestore(uid);
  return remote ?? emptyDashboard();
}

// ─── Migration: import existing pills/doses ──────────
// (Can be called once to migrate data from old schema to new)

export async function initializeDashboardIfNeeded(uid: string): Promise<boolean> {
  // Check cache first — if we have cached data, the doc definitely exists (0 reads)
  const cached = await getCachedDashboard(uid).catch(() => null);
  if (cached) return false;

  // Cache miss — check Firestore (1 read, only on first-ever app open)
  const snap = await getDoc(dashboardRef(uid));
  if (snap.exists()) return false;

  // Create empty dashboard document
  const empty = emptyDashboard();
  await setDoc(dashboardRef(uid), toFirestoreDashboard(empty));
  await setCachedDashboard(uid, serializeDashboard(empty));
  return true;
}
