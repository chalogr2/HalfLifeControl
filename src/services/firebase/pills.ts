/**
 * Firestore CRUD — Optimized single-document + monthly bucketing.
 *
 * Schema:
 *   users/{uid}/data/dashboard   → all pills + active doses (1 read per app open)
 *   users/{uid}/history/{YYYY-MM} → all doses for a month (1 read per month)
 *
 * SIZE BUDGET (Firestore 1 MiB doc limit):
 *   Pill ~300 bytes, Dose ~300 bytes.
 *   Dashboard: 20 pills + 30 active doses ≈ 15 KB (1.5% of limit).
 *   Monthly history: 30 doses/day × 31 days ≈ 270 KB (26% of limit).
 *   Headroom is enormous. Do NOT add unrelated data to these documents.
 *   Background sync prunes expired active doses and pills inactive 6+ months.
 *   See firestore.indexes.json for index exemptions on array fields.
 *
 * Write strategy (hybrid WAL — multi-device safe):
 *
 *   APPENDS (addDose, addHistoryDose) — 0 reads, 1 write:
 *     1. Update local cache
 *     2. Enqueue operation to WAL
 *     3. Attempt Firestore arrayUnion (atomic append, no read needed)
 *     4. On success → dequeue
 *
 *   MUTATIONS (addPill, updatePill, deletePill, removeDose, updateHistoryDoseStatus) — 1 read, 1 write:
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
  enqueueWriteBatch,
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

function countActivePills(pills: Pill[]): number {
  return pills.filter((p) => p.isActive).length;
}

function countActiveScheduled(pills: Pill[]): number {
  return pills.filter((p) => p.isActive && p.pillType === 'scheduled').length;
}

/**
 * Count random pills currently consuming a slot: must have a non-eliminated
 * active dose. Once the countdown completes, the slot is freed.
 */
function countActiveRandom(pills: Pill[], activeDoses: Dose[]): number {
  const now = Date.now();
  return pills.filter((p) => {
    if (!p.isActive || p.pillType !== 'random') return false;
    return activeDoses.some(
      (d) => d.pillId === p.id && d.status === 'active' && d.eliminationAt.getTime() > now,
    );
  }).length;
}

/** Recompute all pill counters from the pills + activeDoses arrays. */
function recomputeCounts(dashboard: DashboardDocument): void {
  dashboard.activePillCount = countActivePills(dashboard.pills);
  dashboard.activeScheduledCount = countActiveScheduled(dashboard.pills);
  dashboard.activeRandomCount = countActiveRandom(dashboard.pills, dashboard.activeDoses);
}

function serializeDashboard(data: DashboardDocument): string {
  return JSON.stringify({
    pills: data.pills.map(serializePill),
    activeDoses: data.activeDoses.map(serializeDose),
    activePillCount: data.activePillCount,
    activeScheduledCount: data.activeScheduledCount,
    activeRandomCount: data.activeRandomCount,
    updatedAt: data.updatedAt.toISOString(),
  });
}

function deserializeDashboard(json: string): DashboardDocument {
  const raw = JSON.parse(json);
  const pills = (raw.pills ?? []).map(deserializePill);
  const activeDoses: Dose[] = (raw.activeDoses ?? []).map(deserializeDose);
  return {
    pills,
    activeDoses,
    // Recompute from pills if fields are missing (migration from old cache)
    activePillCount: raw.activePillCount ?? countActivePills(pills),
    activeScheduledCount: raw.activeScheduledCount ?? countActiveScheduled(pills),
    activeRandomCount: raw.activeRandomCount ?? countActiveRandom(pills, activeDoses),
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
    preferredTimer: raw.preferredTimer ?? 'clearance',
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
    activePillCount: data.activePillCount,
    activeScheduledCount: data.activeScheduledCount,
    activeRandomCount: data.activeRandomCount,
    updatedAt: serverTimestamp(),
  };
}

function parseDashboardDoc(docData: Record<string, any>): DashboardDocument {
  const pills = (docData.pills ?? []).map(deserializePill);
  const activeDoses: Dose[] = (docData.activeDoses ?? []).map(deserializeDose);
  return {
    pills,
    activeDoses,
    activePillCount: docData.activePillCount ?? countActivePills(pills),
    activeScheduledCount: docData.activeScheduledCount ?? countActiveScheduled(pills),
    activeRandomCount: docData.activeRandomCount ?? countActiveRandom(pills, activeDoses),
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
  return { pills: [], activeDoses: [], activePillCount: 0, activeScheduledCount: 0, activeRandomCount: 0, updatedAt: new Date() };
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

      // ── Housekeeping: prune stale data from Firestore ──
      // Without this, expired doses and long-inactive pills accumulate
      // in the dashboard doc forever. Run on every background sync.
      const now = new Date();
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const beforeDoses = remote.activeDoses.length;
      const beforePills = remote.pills.length;

      // Remove expired/dismissed doses
      remote.activeDoses = remote.activeDoses.filter(
        (d) => d.eliminationAt > now && d.status === 'active',
      );
      // Remove pills that have been inactive for 6+ months
      remote.pills = remote.pills.filter(
        (p) => p.isActive || p.updatedAt > sixMonthsAgo,
      );

      const pruned =
        remote.activeDoses.length < beforeDoses ||
        remote.pills.length < beforePills;

      // Recompute counters after pruning
      recomputeCounts(remote);

      // Write pruned data back to Firestore so stale entries don't accumulate
      if (pruned) {
        await setDoc(dashboardRef(uid), toFirestoreDashboard(remote))
          .catch(captureException);
      }

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
      if (!entry.operation) {
        // Legacy state-based entries from before the operations migration.
        // Log the loss so it's visible in Sentry — these writes are unrecoverable
        // because the old format didn't store enough info to replay.
        captureException(
          new Error(`WAL migration: dropped legacy entry ${entry.id} (no operation field). ` +
            `Created at ${new Date(entry.createdAt).toISOString()}. ` +
            `This entry used the old snapshot format and cannot be replayed.`),
        );
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
      const pillId = pill.id;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(dashboardRef(uid));
        const current = snap.exists() ? parseDashboardDoc(snap.data()) : emptyDashboard();
        // Idempotent: skip if pill ID already exists (WAL replay after partial success)
        if (current.pills.some((p) => p.id === pillId)) return;
        current.pills.push(deserializePill(pill));
        recomputeCounts(current);
        tx.set(dashboardRef(uid), toFirestoreDashboard(current));
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
        recomputeCounts(remote);
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
        recomputeCounts(remote);
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

    case 'updateHistoryDoseStatus': {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(historyRef(uid, operation.month));
        if (!snap.exists()) return;
        const history = parseHistoryDoc(snap.data());
        const idx = history.doses.findIndex((d) => d.id === operation.doseId);
        if (idx === -1) return;
        history.doses[idx].status = operation.status as Dose['status'];
        history.updatedAt = new Date();
        tx.set(historyRef(uid, operation.month), {
          month: history.month,
          doses: history.doses.map(serializeDose),
          updatedAt: serverTimestamp(),
        });
      });
      break;
    }
  }
}

// ─── WAL helpers ──────────────────────────────────────

/**
 * Common pattern: enqueue operation → fire Firestore write in background → dequeue on success.
 *
 * Order matters: WAL enqueue happens BEFORE cache update, so a crash between
 * the two can't leave optimistic local state without a corresponding WAL entry.
 *
 * The Firestore write is NOT awaited — once the WAL entry is durable (AsyncStorage),
 * the local mutation is considered committed and callers can return immediately.
 * Awaiting the network round-trip would block every UI update that follows a mutation
 * (e.g. dashboard re-render after a pill edit) on ~hundreds of ms of Firestore latency.
 * Failures leave the entry in the WAL and are retried on next app open.
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

  // Fire-and-forget: Firestore attempt runs in background, WAL retries on failure.
  executeOperation(uid, operation)
    .then(() => dequeueWrite(uid, entryId))
    .catch(captureException);
}

/**
 * Enqueue multiple operations atomically to the WAL before attempting any writes.
 * All entries are persisted in a single AsyncStorage write — a kill between
 * entries is impossible because it's one setItem call.
 * Returns entry IDs for dequeue tracking.
 */
async function enqueueMultiple(
  uid: string,
  operations: WriteOperation[],
): Promise<{ id: string; operation: WriteOperation }[]> {
  const now = Date.now();
  const entries = operations.map((operation) => ({
    id: generateId(),
    operation,
  }));
  const walEntries: WriteQueueEntry[] = entries.map(({ id, operation }) => ({
    id,
    operation,
    createdAt: now,
  }));
  await enqueueWriteBatch(uid, walEntries);
  return entries;
}

/**
 * Fire Firestore writes for previously-enqueued WAL entries in the background.
 * Dequeues each entry on success; leaves in WAL on failure for next-open retry.
 * Not awaited — same rationale as enqueueAndAttempt: the WAL is the durable
 * write, Firestore is just a sync target, so callers shouldn't block on the network.
 */
function attemptEnqueued(
  uid: string,
  entries: { id: string; operation: WriteOperation }[],
): void {
  for (const { id, operation } of entries) {
    executeOperation(uid, operation)
      .then(() => dequeueWrite(uid, id))
      .catch(captureException);
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
  recomputeCounts(dashboard);
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
  recomputeCounts(dashboard);
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
  recomputeCounts(dashboard);
  dashboard.updatedAt = new Date();

  // WAL first, then cache
  await enqueueAndAttempt(uid, { op: 'deletePill', pillId });
  await setCachedDashboard(uid, serializeDashboard(dashboard));

  return dashboard;
}

// ─── Doses ───────────────────────────────────────────

/**
 * Record a dose: updates dashboard AND monthly history atomically.
 *
 * Both WAL entries are enqueued BEFORE any Firestore write, so a crash
 * between the two writes can't leave dashboard and history out of sync.
 */
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

  // Update local state
  dashboard.activeDoses.push(newDose);
  dashboard.updatedAt = now;

  const serializedDose = serializeDose(newDose);
  const month = toMonthKey(newDose.takenAt);

  // Enqueue BOTH operations to WAL first — atomic guarantee.
  // If app crashes after this point, both operations will be retried on next open.
  const entries = await enqueueMultiple(uid, [
    { op: 'addDose', dose: JSON.stringify(serializedDose) },
    { op: 'addHistoryDose', month, dose: JSON.stringify(serializedDose) },
  ]);

  // Update both caches
  await setCachedDashboard(uid, serializeDashboard(dashboard));
  await updateHistoryCache(uid, month, newDose);

  // Fire Firestore writes in background (failures stay in WAL for next-open retry)
  attemptEnqueued(uid, entries);

  return { id: newDose.id, dashboard };
}

/**
 * Update dose status (dismiss/complete). Updates both dashboard and history.
 */
export async function updateDoseStatus(
  uid: string,
  doseId: string,
  status: 'active' | 'dismissed' | 'completed',
): Promise<DashboardDocument> {
  const dashboard = await getCurrentDashboard(uid);
  const doseIdx = dashboard.activeDoses.findIndex((d) => d.id === doseId);

  // Capture dose info before removing (needed for history update)
  const dose = doseIdx !== -1 ? dashboard.activeDoses[doseIdx] : null;

  if (doseIdx !== -1) {
    dashboard.activeDoses[doseIdx].status = status;
    if (status !== 'active') {
      dashboard.activeDoses.splice(doseIdx, 1);
    }
  }
  dashboard.updatedAt = new Date();

  // Build operations list — dashboard removal + history status update
  const operations: WriteOperation[] = [{ op: 'removeDose', doseId }];
  if (dose) {
    const month = toMonthKey(dose.takenAt);
    operations.push({ op: 'updateHistoryDoseStatus', month, doseId, status });

    // Update history cache
    const history = await getCachedMonthHistory(uid, month);
    const histIdx = history.doses.findIndex((d) => d.id === doseId);
    if (histIdx !== -1) {
      history.doses[histIdx].status = status as Dose['status'];
      history.updatedAt = new Date();
      await setCachedHistory(uid, month, JSON.stringify({
        month: history.month,
        doses: history.doses.map(serializeDose),
        updatedAt: history.updatedAt.toISOString(),
      }));
    }
  }

  // Enqueue all operations atomically, then fire Firestore writes in background
  const entries = await enqueueMultiple(uid, operations);
  await setCachedDashboard(uid, serializeDashboard(dashboard));
  attemptEnqueued(uid, entries);

  return dashboard;
}

// ─── History ─────────────────────────────────────────

/** Update local history cache with a new dose (write path only). */
async function updateHistoryCache(uid: string, month: string, dose: Dose): Promise<void> {
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

/**
 * Read month history: fetches from Firestore and merges with any
 * locally-pending doses that haven't synced yet.
 *
 * This avoids the cross-device sync bug where a cold local cache would
 * shadow doses recorded on another device.
 */
async function getMonthHistory(uid: string, month: string): Promise<MonthlyHistoryDocument> {
  // Try Firestore first for authoritative data
  let remote: MonthlyHistoryDocument | null = null;
  try {
    const snap = await getDoc(historyRef(uid, month));
    if (snap.exists()) {
      remote = parseHistoryDoc(snap.data());
    }
  } catch {
    // Offline — fall back to cache below
  }

  if (remote) {
    // Merge remote data with local cache:
    // - Doses only in remote → include as-is
    // - Doses only in local → include (WAL entries not yet flushed)
    // - Doses in both → prefer local status (may be dismissed/completed locally
    //   while remote still shows active, until WAL flushes)
    const cached = await getCachedMonthHistory(uid, month);
    const localById = new Map(cached.doses.map((d) => [d.id, d]));
    const mergedIds = new Set<string>();
    const merged: Dose[] = [];

    for (const remoteDose of remote.doses) {
      const localDose = localById.get(remoteDose.id);
      if (localDose) {
        // Both exist — use remote data but prefer local status if it's more advanced
        const statusPriority = { active: 0, completed: 1, dismissed: 1 };
        const useLocal = (statusPriority[localDose.status] ?? 0) > (statusPriority[remoteDose.status] ?? 0);
        merged.push(useLocal ? { ...remoteDose, status: localDose.status } : remoteDose);
      } else {
        merged.push(remoteDose);
      }
      mergedIds.add(remoteDose.id);
    }

    // Add local-only doses (pending WAL entries)
    for (const localDose of cached.doses) {
      if (!mergedIds.has(localDose.id)) {
        merged.push(localDose);
      }
    }

    remote.doses = merged;
    // Update cache with merged data
    await setCachedHistory(uid, month, JSON.stringify({
      month: remote.month,
      doses: remote.doses.map(serializeDose),
      updatedAt: remote.updatedAt.toISOString(),
    })).catch(() => {});
    return remote;
  }

  // Offline or no remote data — return local cache
  return await getCachedMonthHistory(uid, month);
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
