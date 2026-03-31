/**
 * Firestore CRUD — Optimized single-document + monthly bucketing.
 *
 * Schema:
 *   users/{uid}/data/dashboard   → all pills + active doses (1 read per app open)
 *   users/{uid}/history/{YYYY-MM} → all doses for a month (1 read per month)
 *
 * Write strategy: update cache immediately, then push to Firestore.
 * The SDK queues writes internally if offline.
 */
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
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

function toFirestoreHistory(data: MonthlyHistoryDocument): Record<string, any> {
  return {
    month: data.month,
    doses: data.doses.map(serializeDose),
    updatedAt: serverTimestamp(),
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
 * Load dashboard: cache first, then Firestore sync.
 * Returns cached data immediately if available, then calls
 * onSync with fresh data from Firestore.
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

  // 2. Fetch from Firestore in background (1 read)
  fetchDashboardFromFirestore(uid).then((remote) => {
    if (remote) {
      // Clean up eliminated doses
      const now = new Date();
      remote.activeDoses = remote.activeDoses.filter(
        (d) => d.eliminationAt > now && d.status === 'active',
      );
      // Update cache
      setCachedDashboard(uid, serializeDashboard(remote)).catch(() => {});
      setLastSyncTime(uid).catch(() => {});
      // Notify caller
      onSync?.(remote);
    }
  }).catch((err) => {
    captureException(err);
  });

  return cached ?? emptyDashboard();
}

async function fetchDashboardFromFirestore(uid: string): Promise<DashboardDocument | null> {
  const snap = await getDoc(dashboardRef(uid));
  if (!snap.exists()) return null;
  return parseDashboardDoc(snap.data());
}

// ─── Dashboard: Write helpers ────────────────────────

async function saveDashboard(uid: string, data: DashboardDocument): Promise<void> {
  // Update cache immediately
  await setCachedDashboard(uid, serializeDashboard(data));
  // Push to Firestore (SDK queues if offline)
  try {
    await setDoc(dashboardRef(uid), toFirestoreDashboard(data));
  } catch (error) {
    captureException(error);
    throw error;
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
  await saveDashboard(uid, dashboard);
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
  await saveDashboard(uid, dashboard);
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
  await saveDashboard(uid, dashboard);
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

  // Save dashboard (1 write)
  await saveDashboard(uid, dashboard);

  // Append to monthly history bucket (1 write)
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
  await saveDashboard(uid, dashboard);
  return dashboard;
}

// ─── History ─────────────────────────────────────────

async function appendToHistory(uid: string, dose: Dose): Promise<void> {
  const month = toMonthKey(dose.takenAt);
  try {
    const history = await getMonthHistory(uid, month);
    history.doses.push(dose);
    history.updatedAt = new Date();

    // Update cache
    await setCachedHistory(uid, month, JSON.stringify({
      month: history.month,
      doses: history.doses.map(serializeDose),
      updatedAt: history.updatedAt.toISOString(),
    }));

    // Push to Firestore
    await setDoc(historyRef(uid, month), toFirestoreHistory(history));
  } catch (error) {
    captureException(error);
    throw error;
  }
}

async function getMonthHistory(uid: string, month: string): Promise<MonthlyHistoryDocument> {
  // Try cache
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
  const snap = await getDoc(dashboardRef(uid));
  if (snap.exists()) return false; // Already migrated

  // Create empty dashboard document
  const empty = emptyDashboard();
  await setDoc(dashboardRef(uid), toFirestoreDashboard(empty));
  await setCachedDashboard(uid, serializeDashboard(empty));
  return true;
}
