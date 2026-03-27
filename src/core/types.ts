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

export interface UserSettings {
  autoAssumeTaken: boolean;
  notificationsEnabled: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  onboardingComplete: boolean;
  subscriptionTier: SubscriptionTier;
  settings: UserSettings;
}
