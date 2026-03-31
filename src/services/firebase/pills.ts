/**
 * Firestore CRUD for pills and doses.
 */
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './config';
import { eliminationDate } from '@/core/halflife';
import { captureException } from '@/services/sentry';
import type { Pill, Dose, DoseSource } from '@/core/types';

// ─── Helpers ──────────────────────────────────────────

function pillsRef(userId: string) {
  return collection(db, 'users', userId, 'pills');
}

function dosesRef(userId: string) {
  return collection(db, 'users', userId, 'doses');
}

function toDate(val: Timestamp | Date | null): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return new Date();
}

// ─── Pills ────────────────────────────────────────────

export async function addPill(
  userId: string,
  pill: Omit<Pill, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  try {
    const ref = await addDoc(pillsRef(userId), {
      ...pill,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    captureException(error);
    throw error;
  }
}

export async function updatePill(
  userId: string,
  pillId: string,
  data: Partial<Omit<Pill, 'id' | 'createdAt'>>,
): Promise<void> {
  await updateDoc(doc(pillsRef(userId), pillId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePill(userId: string, pillId: string): Promise<void> {
  await deleteDoc(doc(pillsRef(userId), pillId));
}

export async function fetchPills(userId: string): Promise<Pill[]> {
  const snap = await getDocs(
    query(pillsRef(userId), orderBy('createdAt', 'desc')),
  );
  return snap.docs.map((d) => toPill(d.id, d.data()));
}

export function subscribePills(
  userId: string,
  callback: (pills: Pill[]) => void,
): Unsubscribe {
  const q = query(pillsRef(userId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => toPill(d.id, d.data())));
  });
}

function toPill(id: string, data: Record<string, any>): Pill {
  return {
    id,
    drugName: data.drugName,
    drugId: data.drugId ?? '',
    halfLifeMinutes: data.halfLifeMinutes,
    halfLifeSource: data.halfLifeSource ?? 'manual',
    dosageMg: data.dosageMg,
    dosageUnit: data.dosageUnit ?? 'mg',
    pillType: data.pillType,
    schedule: data.schedule ?? null,
    color: data.color ?? '#004d64',
    isActive: data.isActive ?? true,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

// ─── Doses ────────────────────────────────────────────

export async function recordDose(
  userId: string,
  pill: Pick<Pill, 'id' | 'drugName' | 'halfLifeMinutes'>,
  takenAt: Date,
  source: DoseSource,
  scheduledFor?: Date | null,
): Promise<string> {
  try {
    const elimAt = eliminationDate(takenAt, pill.halfLifeMinutes);
    const ref = await addDoc(dosesRef(userId), {
      pillId: pill.id,
      drugName: pill.drugName,
      takenAt: Timestamp.fromDate(takenAt),
      scheduledFor: scheduledFor ? Timestamp.fromDate(scheduledFor) : null,
      halfLifeMinutes: pill.halfLifeMinutes,
      eliminationAt: Timestamp.fromDate(elimAt),
      status: 'active',
      source,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    captureException(error);
    throw error;
  }
}

export async function updateDoseStatus(
  userId: string,
  doseId: string,
  status: 'active' | 'dismissed' | 'completed',
): Promise<void> {
  await updateDoc(doc(dosesRef(userId), doseId), { status });
}

export async function fetchActiveDoses(userId: string): Promise<Dose[]> {
  const snap = await getDocs(
    query(
      dosesRef(userId),
      where('status', '==', 'active'),
      orderBy('takenAt', 'desc'),
    ),
  );
  return snap.docs.map((d) => toDose(d.id, d.data()));
}

export function subscribeActiveDoses(
  userId: string,
  callback: (doses: Dose[]) => void,
): Unsubscribe {
  const q = query(
    dosesRef(userId),
    where('status', '==', 'active'),
    orderBy('takenAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => toDose(d.id, d.data())));
  });
}

function toDose(id: string, data: Record<string, any>): Dose {
  return {
    id,
    pillId: data.pillId,
    drugName: data.drugName,
    takenAt: toDate(data.takenAt),
    scheduledFor: data.scheduledFor ? toDate(data.scheduledFor) : null,
    halfLifeMinutes: data.halfLifeMinutes,
    eliminationAt: toDate(data.eliminationAt),
    status: data.status,
    source: data.source ?? 'manual',
    createdAt: toDate(data.createdAt),
  };
}

// ─── History Queries ─────────────────────────────────

export interface DoseHistoryPage {
  doses: Dose[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

/** Fetch dose history (all statuses), paginated, newest first. */
export async function fetchDoseHistory(
  userId: string,
  pageSize: number = 50,
  afterDoc?: QueryDocumentSnapshot | null,
): Promise<DoseHistoryPage> {
  let q = query(
    dosesRef(userId),
    orderBy('takenAt', 'desc'),
    firestoreLimit(pageSize + 1),
  );
  if (afterDoc) {
    q = query(
      dosesRef(userId),
      orderBy('takenAt', 'desc'),
      startAfter(afterDoc),
      firestoreLimit(pageSize + 1),
    );
  }
  const snap = await getDocs(q);
  const hasMore = snap.docs.length > pageSize;
  const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
  return {
    doses: docs.map((d) => toDose(d.id, d.data())),
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore,
  };
}

/** Fetch all doses for a specific date range (inclusive). */
export async function fetchDosesByDateRange(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<Dose[]> {
  const snap = await getDocs(
    query(
      dosesRef(userId),
      where('takenAt', '>=', Timestamp.fromDate(startDate)),
      where('takenAt', '<=', Timestamp.fromDate(endDate)),
      orderBy('takenAt', 'asc'),
    ),
  );
  return snap.docs.map((d) => toDose(d.id, d.data()));
}
