/** Domain types for HalfLifeControl. */

export type PillType = 'scheduled' | 'random';
export type ScheduleFrequency = 'daily' | 'specific_days' | 'every_n_days';
export type DoseStatus = 'active' | 'dismissed' | 'completed';
export type DoseSource = 'manual' | 'notification' | 'auto' | 'retroactive';
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
  halfLifeSource: 'openfda' | 'curated' | 'manual';
  dosageMg: number;
  dosageUnit: string;
  pillType: PillType;
  schedule: PillSchedule | null;
  color: string;
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

// ─── Firestore Document Schemas (Optimized) ─────────

/**
 * Single-document vault for the user's active state.
 * Path: users/{uid}/data/dashboard
 *
 * 1 read per app open instead of N pills + N doses.
 */
export interface DashboardDocument {
  pills: Pill[];
  activeDoses: Dose[];
  activePillCount: number;
  activeScheduledCount: number;
  activeRandomCount: number;
  updatedAt: Date;
}

/**
 * Monthly bucketed dose history.
 * Path: users/{uid}/history/{YYYY-MM}
 *
 * 1 read per month of history instead of N individual dose docs.
 */
export interface MonthlyHistoryDocument {
  month: string; // "YYYY-MM"
  doses: Dose[];
  updatedAt: Date;
}

/** Generate a unique ID for pills/doses (replaces Firestore auto-IDs). */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}_${random}`;
}
