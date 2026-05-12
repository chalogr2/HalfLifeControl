/** Domain types for HalfLifeControl. */

export type PillType = 'scheduled' | 'random';
export type ScheduleFrequency = 'daily' | 'specific_days' | 'every_n_days';
export type DoseStatus = 'active' | 'dismissed' | 'completed';
export type DoseSource = 'manual' | 'notification' | 'auto' | 'retroactive';
export type TimerType = 'action' | 'halfLife' | 'clearance';
export type SubscriptionTier = 'free' | 'pro';
/**
 * Classifies what the "third timer" represents for a given drug:
 * - 'action'   → true pharmacodynamic duration of action (e.g. ibuprofen 6h analgesia)
 * - 'interval' → labelled/maintenance dosing interval (e.g. clonazepam BID = 12h)
 * - 'none'     → no citable duration (PRN / OTC / supplement); hide the third timer
 */
export type DurationType = 'action' | 'interval' | 'none';

export interface PillSchedule {
  timeOfDay: string; // "HH:mm"
  frequency: ScheduleFrequency;
  daysOfWeek?: number[]; // 0=Sun, 1=Mon, etc.
  intervalDays?: number;
}

export interface Pill {
  id: string;
  drugName: string;
  drugId: string;
  halfLifeMinutes: number;
  halfLifeSource: 'openfda' | 'curated' | 'manual' | 'pubchem';
  /**
   * Snapshot of curated duration of action at pill creation time.
   * null = no curated value; UI falls back to 2 × halfLifeMinutes multiplier.
   * Snapshotted (not looked up live) so future DB updates don't retroactively change existing pills.
   */
  durationOfActionMinutes: number | null;
  /**
   * Snapshot of how to label & whether to show the third timer.
   * Defaults to 'action' for legacy rows without the field.
   */
  durationType: DurationType;
  /** If true, the interval is a maintenance-dose interval (e.g. methotrexate weekly). */
  isMaintenanceInterval?: boolean;
  /** If true, show a prominent warning that this drug is dosed weekly (methotrexate safety). */
  requiresWeeklyWarning?: boolean;
  dosageMg: number;
  dosageUnit: string;
  pillType: PillType;
  schedule: PillSchedule | null;
  color: string;
  preferredTimer: TimerType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Dose {
  id: string;
  pillId: string;
  drugName: string;
  takenAt: Date;
  scheduledFor: Date | null;
  halfLifeMinutes: number;
  /** Snapshot of duration of action at dose creation time. null → fall back to 2× halfLifeMinutes. */
  durationOfActionMinutes: number | null;
  /** Snapshot of the duration-type label at dose creation time. */
  durationType: DurationType;
  isMaintenanceInterval?: boolean;
  requiresWeeklyWarning?: boolean;
  eliminationAt: Date;
  status: DoseStatus;
  source: DoseSource;
  createdAt: Date;
}

export type ReminderMode = 'prompt' | 'simple' | 'off';

export interface UserSettings {
  autoAssumeTaken: boolean;
  notificationsEnabled: boolean;
  /**
   * If true, a one-shot banner fires when each active dose's
   * `eliminationAt` is reached ("{drug} has cleared from your system").
   * Defaults to true. Independent of `reminderMode` — that controls
   * scheduled-time reminders only.
   */
  eliminationNotificationsEnabled: boolean;
  reminderMode: ReminderMode;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  onboardingComplete: boolean;
  subscriptionTier: SubscriptionTier;
  settings: UserSettings;
}

// ─── In-Memory / Cache Schemas ───────────────────────

/**
 * Aggregated dashboard state held in memory and cache.
 * Populated from Supabase pills + active doses queries on sync.
 */
export interface DashboardDocument {
  pills: Pill[];
  activeDoses: Dose[];
  activePillCount: number;
  activeScheduledCount: number;
  activeRandomCount: number;
  updatedAt: Date;
}

/** Generate a v4 UUID for pills/doses. Compatible with Postgres uuid columns. */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
