/** Domain types for HalfLifeControl. */

export type PillType = 'scheduled' | 'random';
export type ScheduleFrequency = 'daily' | 'specific_days' | 'every_n_days';
export type DoseStatus = 'active' | 'dismissed' | 'completed';
export type DoseSource = 'manual' | 'notification' | 'auto' | 'retroactive';
export type TimerType = 'action' | 'halfLife' | 'clearance';
export type SubscriptionTier = 'free' | 'pro';

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
  eliminationAt: Date;
  status: DoseStatus;
  source: DoseSource;
  createdAt: Date;
}

export type ReminderMode = 'auto_start' | 'prompt' | 'simple';

export interface UserSettings {
  autoAssumeTaken: boolean;
  notificationsEnabled: boolean;
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
