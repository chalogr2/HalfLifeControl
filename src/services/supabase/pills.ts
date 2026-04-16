/**
 * Supabase CRUD — Normalized Postgres tables with WAL offline support.
 *
 * Schema:
 *   public.pills  → one row per pill (SELECT by user_id)
 *   public.doses  → one row per dose (SELECT by user_id, active or history)
 *
 * Write strategy (hybrid WAL — multi-device safe):
 *   All mutations follow the same pattern:
 *     1. Update local cache
 *     2. Enqueue operation to WAL (survives app kill)
 *     3. Attempt Supabase write in background (fire-and-forget)
 *     4. On success → dequeue WAL entry
 *
 *   Because Postgres handles row-level writes natively, there are no
 *   transactions or read-before-write — every operation is a single
 *   INSERT or UPDATE.
 */
import { supabase } from './config';
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
} from '@/core/types';
import { generateId } from '@/core/types';

// ─── Helpers ──────────────────────────────────────────

function toDate(val: any): Date {
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') return new Date(val);
  return new Date();
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
    drugName: raw.drugName ?? raw.drug_name,
    drugId: raw.drugId ?? raw.drug_id ?? '',
    halfLifeMinutes: raw.halfLifeMinutes ?? raw.half_life_minutes,
    halfLifeSource: raw.halfLifeSource ?? raw.half_life_source ?? 'manual',
    durationOfActionMinutes:
      raw.durationOfActionMinutes ?? raw.duration_of_action_minutes ?? null,
    durationType:
      (raw.durationType ?? raw.duration_type ?? 'action') as Pill['durationType'],
    isMaintenanceInterval:
      raw.isMaintenanceInterval ?? raw.is_maintenance_interval ?? false,
    requiresWeeklyWarning:
      raw.requiresWeeklyWarning ?? raw.requires_weekly_warning ?? false,
    dosageMg: raw.dosageMg ?? raw.dosage_mg,
    dosageUnit: raw.dosageUnit ?? raw.dosage_unit ?? 'mg',
    pillType: raw.pillType ?? raw.pill_type,
    schedule: raw.schedule ?? null,
    color: raw.color ?? '#004d64',
    preferredTimer: raw.preferredTimer ?? raw.preferred_timer ?? 'clearance',
    isActive: raw.isActive ?? raw.is_active ?? true,
    createdAt: toDate(raw.createdAt ?? raw.created_at),
    updatedAt: toDate(raw.updatedAt ?? raw.updated_at),
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
    pillId: raw.pillId ?? raw.pill_id,
    drugName: raw.drugName ?? raw.drug_name,
    takenAt: toDate(raw.takenAt ?? raw.taken_at),
    scheduledFor: (raw.scheduledFor ?? raw.scheduled_for) ? toDate(raw.scheduledFor ?? raw.scheduled_for) : null,
    halfLifeMinutes: raw.halfLifeMinutes ?? raw.half_life_minutes,
    durationOfActionMinutes:
      raw.durationOfActionMinutes ?? raw.duration_of_action_minutes ?? null,
    durationType:
      (raw.durationType ?? raw.duration_type ?? 'action') as Dose['durationType'],
    isMaintenanceInterval:
      raw.isMaintenanceInterval ?? raw.is_maintenance_interval ?? false,
    requiresWeeklyWarning:
      raw.requiresWeeklyWarning ?? raw.requires_weekly_warning ?? false,
    eliminationAt: toDate(raw.eliminationAt ?? raw.elimination_at),
    status: raw.status,
    source: raw.source ?? 'manual',
    createdAt: toDate(raw.createdAt ?? raw.created_at),
  };
}

/** Convert a Pill to Supabase row format (snake_case). */
function pillToRow(pill: Pill, userId: string): Record<string, any> {
  return {
    id: pill.id,
    user_id: userId,
    drug_name: pill.drugName,
    drug_id: pill.drugId || null,
    half_life_minutes: pill.halfLifeMinutes,
    half_life_source: pill.halfLifeSource,
    duration_of_action_minutes: pill.durationOfActionMinutes,
    duration_type: pill.durationType ?? 'action',
    is_maintenance_interval: pill.isMaintenanceInterval ?? false,
    requires_weekly_warning: pill.requiresWeeklyWarning ?? false,
    dosage_mg: pill.dosageMg,
    dosage_unit: pill.dosageUnit,
    pill_type: pill.pillType,
    schedule: pill.schedule,
    color: pill.color,
    preferred_timer: pill.preferredTimer,
    is_active: pill.isActive,
    created_at: pill.createdAt.toISOString(),
    updated_at: pill.updatedAt.toISOString(),
  };
}

/** Convert a Dose to Supabase row format (snake_case). */
function doseToRow(dose: Dose, userId: string): Record<string, any> {
  return {
    id: dose.id,
    user_id: userId,
    pill_id: dose.pillId,
    drug_name: dose.drugName,
    taken_at: dose.takenAt.toISOString(),
    scheduled_for: dose.scheduledFor?.toISOString() ?? null,
    half_life_minutes: dose.halfLifeMinutes,
    duration_of_action_minutes: dose.durationOfActionMinutes,
    duration_type: dose.durationType ?? 'action',
    is_maintenance_interval: dose.isMaintenanceInterval ?? false,
    requires_weekly_warning: dose.requiresWeeklyWarning ?? false,
    elimination_at: dose.eliminationAt.toISOString(),
    status: dose.status,
    source: dose.source,
    created_at: dose.createdAt.toISOString(),
  };
}

function countActivePills(pills: Pill[]): number {
  return pills.filter((p) => p.isActive).length;
}

function countActiveScheduled(pills: Pill[]): number {
  return pills.filter((p) => p.isActive && p.pillType === 'scheduled').length;
}

function countActiveRandom(pills: Pill[], activeDoses: Dose[]): number {
  const now = Date.now();
  return pills.filter((p) => {
    if (!p.isActive || p.pillType !== 'random') return false;
    return activeDoses.some(
      (d) => d.pillId === p.id && d.status === 'active' && d.eliminationAt.getTime() > now,
    );
  }).length;
}

function recomputeCounts(dashboard: DashboardDocument): void {
  dashboard.activePillCount = countActivePills(dashboard.pills);
  dashboard.activeScheduledCount = countActiveScheduled(dashboard.pills);
  dashboard.activeRandomCount = countActiveRandom(dashboard.pills, dashboard.activeDoses);
}

// ─── Empty state ─────────────────────────────────────

function emptyDashboard(): DashboardDocument {
  return {
    pills: [],
    activeDoses: [],
    activePillCount: 0,
    activeScheduledCount: 0,
    activeRandomCount: 0,
    updatedAt: new Date(),
  };
}

// ─── Dashboard: Load ─────────────────────────────────

/**
 * Load dashboard: cache first, flush pending writes, then Supabase sync.
 *
 * Flow:
 *   1. Return cached data instantly (0 queries)
 *   2. In background: flush any pending writes from WAL
 *   3. Then fetch fresh data from Supabase (2 queries: pills + active doses)
 *   4. Only overwrite cache if no pending writes remain
 */
export async function loadDashboard(
  uid: string,
  onSync?: (data: DashboardDocument) => void,
): Promise<DashboardDocument> {
  // 1. Try cache first (instant)
  let cached: DashboardDocument | null = null;
  try {
    const json = await getCachedDashboard(uid);
    if (json) cached = deserializeDashboard(json);
  } catch {
    // Cache miss or corruption — continue to Supabase
  }

  // 2. Background: flush pending writes, then sync
  (async () => {
    try {
      await flushWriteQueue(uid);

      const remote = await fetchDashboardFromSupabase(uid);
      if (!remote) return;

      const stillPending = await hasPendingWrites(uid);
      if (stillPending) return;

      // Housekeeping: prune expired active doses
      const now = new Date();
      remote.activeDoses = remote.activeDoses.filter(
        (d) => d.eliminationAt > now && d.status === 'active',
      );
      recomputeCounts(remote);

      await setCachedDashboard(uid, serializeDashboard(remote));
      await setLastSyncTime(uid);

      onSync?.(remote);
    } catch (err) {
      captureException(err);
    }
  })();

  return cached ?? emptyDashboard();
}

/**
 * Fetch current dashboard state from Supabase.
 * Two queries: active pills + active doses.
 */
async function fetchDashboardFromSupabase(uid: string): Promise<DashboardDocument | null> {
  const [pillsResult, dosesResult] = await Promise.all([
    supabase
      .from('pills')
      .select('*')
      .eq('user_id', uid)
      .eq('is_active', true),
    supabase
      .from('doses')
      .select('*')
      .eq('user_id', uid)
      .eq('status', 'active'),
  ]);

  if (pillsResult.error && dosesResult.error) return null;

  const pills = (pillsResult.data ?? []).map(deserializePill);
  const activeDoses = (dosesResult.data ?? []).map(deserializeDose);

  return {
    pills,
    activeDoses,
    activePillCount: countActivePills(pills),
    activeScheduledCount: countActiveScheduled(pills),
    activeRandomCount: countActiveRandom(pills, activeDoses),
    updatedAt: new Date(),
  };
}

// ─── Write-Ahead Log: Flush ─────────────────────────

async function flushWriteQueue(uid: string): Promise<void> {
  const queue = await getWriteQueue(uid);
  if (queue.length === 0) return;

  for (const entry of queue) {
    try {
      if (!entry.operation) {
        captureException(
          new Error(`WAL migration: dropped legacy entry ${entry.id} (no operation field). ` +
            `Created at ${new Date(entry.createdAt).toISOString()}.`),
        );
        await dequeueWrite(uid, entry.id);
        continue;
      }
      await executeOperation(uid, entry.operation);
      await dequeueWrite(uid, entry.id);
    } catch {
      // Still offline or DB error — leave in queue for next retry
    }
  }
}

/**
 * Execute a single WAL operation against Supabase.
 * Every operation is a single INSERT or UPDATE — no transactions needed.
 */
async function executeOperation(uid: string, operation: WriteOperation): Promise<void> {
  switch (operation.op) {
    case 'addPill': {
      const pill = deserializePill(JSON.parse(operation.pill));
      const row = pillToRow(pill, uid);
      const { error } = await supabase.from('pills').upsert(row);
      if (error) throw error;
      break;
    }

    case 'addDose':
    case 'addHistoryDose': {
      // Both ops insert a dose. addHistoryDose was a Firestore-era split;
      // in Supabase there's a single doses table. Use upsert for idempotency.
      const dose = deserializeDose(JSON.parse(operation.dose));
      const row = doseToRow(dose, uid);
      const { error } = await supabase.from('doses').upsert(row);
      if (error) throw error;
      break;
    }

    case 'updatePill': {
      const partialData = JSON.parse(operation.data);
      // Convert camelCase fields to snake_case for the DB update
      const dbUpdate: Record<string, any> = {};
      if ('preferredTimer' in partialData) dbUpdate.preferred_timer = partialData.preferredTimer;
      if ('dosageMg' in partialData) dbUpdate.dosage_mg = partialData.dosageMg;
      if ('dosageUnit' in partialData) dbUpdate.dosage_unit = partialData.dosageUnit;
      if ('drugName' in partialData) dbUpdate.drug_name = partialData.drugName;
      if ('drugId' in partialData) dbUpdate.drug_id = partialData.drugId;
      if ('halfLifeMinutes' in partialData) dbUpdate.half_life_minutes = partialData.halfLifeMinutes;
      if ('halfLifeSource' in partialData) dbUpdate.half_life_source = partialData.halfLifeSource;
      if ('durationOfActionMinutes' in partialData) dbUpdate.duration_of_action_minutes = partialData.durationOfActionMinutes;
      if ('durationType' in partialData) dbUpdate.duration_type = partialData.durationType;
      if ('isMaintenanceInterval' in partialData) dbUpdate.is_maintenance_interval = partialData.isMaintenanceInterval;
      if ('requiresWeeklyWarning' in partialData) dbUpdate.requires_weekly_warning = partialData.requiresWeeklyWarning;
      if ('pillType' in partialData) dbUpdate.pill_type = partialData.pillType;
      if ('schedule' in partialData) dbUpdate.schedule = partialData.schedule;
      if ('color' in partialData) dbUpdate.color = partialData.color;
      if ('isActive' in partialData) dbUpdate.is_active = partialData.isActive;

      const { error } = await supabase
        .from('pills')
        .update(dbUpdate)
        .eq('id', operation.pillId)
        .eq('user_id', uid);
      if (error) throw error;
      break;
    }

    case 'deletePill': {
      // Soft delete: mark inactive + dismiss related active doses
      const { error: pillError } = await supabase
        .from('pills')
        .update({ is_active: false })
        .eq('id', operation.pillId)
        .eq('user_id', uid);
      if (pillError) throw pillError;

      // Dismiss active doses for this pill
      await supabase
        .from('doses')
        .update({ status: 'dismissed' })
        .eq('pill_id', operation.pillId)
        .eq('user_id', uid)
        .eq('status', 'active');
      break;
    }

    case 'removeDose': {
      // Dismiss the dose (remove from active, keep in history)
      const { error } = await supabase
        .from('doses')
        .update({ status: 'dismissed' })
        .eq('id', operation.doseId)
        .eq('user_id', uid);
      if (error) throw error;
      break;
    }

    case 'updateHistoryDoseStatus': {
      const { error } = await supabase
        .from('doses')
        .update({ status: operation.status })
        .eq('id', operation.doseId)
        .eq('user_id', uid);
      if (error) throw error;
      break;
    }
  }
}

// ─── WAL helpers ──────────────────────────────────────

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

  // Fire-and-forget: WAL retries on failure
  executeOperation(uid, operation)
    .then(() => dequeueWrite(uid, entryId))
    .catch(captureException);
}

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
  const idx = dashboard.pills.findIndex((p) => p.id === pillId);
  if (idx !== -1) {
    dashboard.pills[idx].isActive = false;
    dashboard.pills[idx].updatedAt = new Date();
  }
  dashboard.activeDoses = dashboard.activeDoses.filter((d) => d.pillId !== pillId);
  recomputeCounts(dashboard);
  dashboard.updatedAt = new Date();

  await enqueueAndAttempt(uid, { op: 'deletePill', pillId });
  await setCachedDashboard(uid, serializeDashboard(dashboard));

  return dashboard;
}

// ─── Doses ───────────────────────────────────────────

export async function recordDose(
  uid: string,
  pill: Pick<
    Pill,
    | 'id'
    | 'drugName'
    | 'halfLifeMinutes'
    | 'durationOfActionMinutes'
    | 'durationType'
    | 'isMaintenanceInterval'
    | 'requiresWeeklyWarning'
  >,
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
    durationOfActionMinutes: pill.durationOfActionMinutes,
    durationType: pill.durationType ?? 'action',
    isMaintenanceInterval: pill.isMaintenanceInterval ?? false,
    requiresWeeklyWarning: pill.requiresWeeklyWarning ?? false,
    eliminationAt: elimAt,
    status: 'active',
    source,
    createdAt: now,
  };

  dashboard.activeDoses.push(newDose);
  dashboard.updatedAt = now;

  const serializedDose = serializeDose(newDose);

  // In Supabase, addDose and addHistoryDose both insert into the same
  // doses table. We only need one WAL entry, but keep addHistoryDose
  // as a no-op replay (upsert is idempotent) for WAL compat.
  const entries = await enqueueMultiple(uid, [
    { op: 'addDose', dose: JSON.stringify(serializedDose) },
  ]);

  await setCachedDashboard(uid, serializeDashboard(dashboard));
  await updateHistoryCache(uid, toMonthKey(newDose.takenAt), newDose);

  attemptEnqueued(uid, entries);

  return { id: newDose.id, dashboard };
}

export async function updateDoseStatus(
  uid: string,
  doseId: string,
  status: 'active' | 'dismissed' | 'completed',
): Promise<DashboardDocument> {
  const dashboard = await getCurrentDashboard(uid);
  const doseIdx = dashboard.activeDoses.findIndex((d) => d.id === doseId);
  const dose = doseIdx !== -1 ? dashboard.activeDoses[doseIdx] : null;

  if (doseIdx !== -1) {
    dashboard.activeDoses[doseIdx].status = status;
    if (status !== 'active') {
      dashboard.activeDoses.splice(doseIdx, 1);
    }
  }
  dashboard.updatedAt = new Date();

  // In Supabase it's just one UPDATE on the doses table
  const operations: WriteOperation[] = [
    { op: 'updateHistoryDoseStatus', month: dose ? toMonthKey(dose.takenAt) : '', doseId, status },
  ];

  if (dose) {
    const month = toMonthKey(dose.takenAt);
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

  const entries = await enqueueMultiple(uid, operations);
  await setCachedDashboard(uid, serializeDashboard(dashboard));
  attemptEnqueued(uid, entries);

  return dashboard;
}

// ─── History ─────────────────────────────────────────

function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

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

interface MonthlyHistory {
  month: string;
  doses: Dose[];
  updatedAt: Date;
}

async function getCachedMonthHistory(uid: string, month: string): Promise<MonthlyHistory> {
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
 * Fetch dose history. Uses a single Supabase query with date range
 * instead of N monthly bucket reads.
 */
export async function fetchDoseHistory(
  uid: string,
  monthCount: number = 3,
): Promise<Dose[]> {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - monthCount + 1, 1);

  // Try Supabase first
  try {
    const { data, error } = await supabase
      .from('doses')
      .select('*')
      .eq('user_id', uid)
      .gte('taken_at', startDate.toISOString())
      .order('taken_at', { ascending: false });

    if (!error && data) {
      const doses = data.map(deserializeDose);

      // Merge with local cache (WAL entries not yet flushed)
      const cached = await getAllCachedDoses(uid, startDate);
      return mergeRemoteAndLocal(doses, cached);
    }
  } catch {
    // Offline — fall through to cache
  }

  // Offline fallback: read from monthly caches
  return getAllCachedDoses(uid, startDate);
}

/**
 * Fetch doses for a specific date range (day detail view).
 */
export async function fetchDosesByDateRange(
  uid: string,
  startDate: Date,
  endDate: Date,
): Promise<Dose[]> {
  try {
    const { data, error } = await supabase
      .from('doses')
      .select('*')
      .eq('user_id', uid)
      .gte('taken_at', startDate.toISOString())
      .lte('taken_at', endDate.toISOString())
      .order('taken_at', { ascending: true });

    if (!error && data) {
      const doses = data.map(deserializeDose);
      const cached = await getDateRangeCachedDoses(uid, startDate, endDate);
      return mergeRemoteAndLocal(doses, cached, true);
    }
  } catch {
    // Offline
  }

  return getDateRangeCachedDoses(uid, startDate, endDate);
}

/** Get all cached doses from monthly caches for the given date range. */
async function getAllCachedDoses(uid: string, startDate: Date): Promise<Dose[]> {
  const now = new Date();
  const months: string[] = [];
  const cursor = new Date(startDate);
  while (cursor <= now) {
    months.push(toMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const allDoses: Dose[] = [];
  for (const month of months) {
    const history = await getCachedMonthHistory(uid, month);
    allDoses.push(...history.doses);
  }
  return allDoses.sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());
}

async function getDateRangeCachedDoses(uid: string, startDate: Date, endDate: Date): Promise<Dose[]> {
  const months = new Set<string>();
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    months.add(toMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const allDoses: Dose[] = [];
  for (const month of months) {
    const history = await getCachedMonthHistory(uid, month);
    allDoses.push(
      ...history.doses.filter(
        (d) => d.takenAt >= startDate && d.takenAt <= endDate,
      ),
    );
  }
  return allDoses.sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime());
}

/**
 * Merge remote and local doses, preferring local status when more advanced.
 */
function mergeRemoteAndLocal(remote: Dose[], local: Dose[], ascending: boolean = false): Dose[] {
  const localById = new Map(local.map((d) => [d.id, d]));
  const mergedIds = new Set<string>();
  const merged: Dose[] = [];

  for (const remoteDose of remote) {
    const localDose = localById.get(remoteDose.id);
    if (localDose) {
      const statusPriority: Record<string, number> = { active: 0, completed: 1, dismissed: 1 };
      const useLocal = (statusPriority[localDose.status] ?? 0) > (statusPriority[remoteDose.status] ?? 0);
      merged.push(useLocal ? { ...remoteDose, status: localDose.status } : remoteDose);
    } else {
      merged.push(remoteDose);
    }
    mergedIds.add(remoteDose.id);
  }

  // Add local-only doses (pending WAL entries)
  for (const localDose of local) {
    if (!mergedIds.has(localDose.id)) {
      merged.push(localDose);
    }
  }

  return merged.sort((a, b) =>
    ascending
      ? a.takenAt.getTime() - b.takenAt.getTime()
      : b.takenAt.getTime() - a.takenAt.getTime(),
  );
}

// ─── Internal: get current dashboard from cache ──────

async function getCurrentDashboard(uid: string): Promise<DashboardDocument> {
  try {
    const json = await getCachedDashboard(uid);
    if (json) return deserializeDashboard(json);
  } catch {
    // Cache miss
  }
  // Fallback to Supabase
  const remote = await fetchDashboardFromSupabase(uid);
  return remote ?? emptyDashboard();
}

// ─── Initialize (no-op in Supabase — tables always exist) ────

/**
 * In Firestore we needed to create the dashboard document on first use.
 * With Supabase, the tables always exist and RLS handles access.
 * This function is kept for API compatibility but does nothing.
 */
export async function initializeDashboardIfNeeded(_uid: string): Promise<boolean> {
  return false;
}
