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
  /**
   * Owning pill ID, or `null` when the pill row has been hard-deleted (e.g.
   * a one-time tracking pill that completed its lifecycle). The dose still
   * carries `drugName` for display; renderers should fall back gracefully
   * when `pillId` is null or the lookup against the current pill list fails.
   */
  pillId: string | null;
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
  /**
   * ISO-8601 timestamp of when `autoAssumeTaken` was most recently flipped
   * on, or null when the setting is currently off / has never been on. Used
   * as the lower-bound anchor for `reconcileAutoAssumedDoses` — we never
   * auto-record doses for time periods when the user hadn't opted in. Flips
   * to null on `true → false`, and re-stamps to the current time on a
   * fresh `false → true` (so toggling off and back on starts a new window).
   */
  autoAssumeTakenEnabledAt: string | null;
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
