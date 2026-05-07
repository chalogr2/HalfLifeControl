/**
 * Local notification service using expo-notifications.
 *
 * Same-time pills are coalesced into one notification so the user gets
 * "Time to take Aspirin, Metformin" instead of two separate banners. Each
 * notification carries `data.pillIds: string[]` for the action handler.
 *
 * Notification actions ("Took it" / "Snooze 15min") are wired through a
 * single category (`pill_reminder`). Both actions open the app to
 * foreground — "Took it" records doses, "Snooze" reschedules a 15-min
 * one-shot. Backgrounded snooze without app launch would require a
 * TaskManager-defined background task, which is heavier native setup;
 * deferred until the cron-based autoAssumeTaken work in Phase 5.
 *
 * Server-side push is also deferred to a follow-up phase.
 */
import * as Notifications from 'expo-notifications';
import type { Pill, UserSettings } from '@/core/types';
import { nextScheduledDose } from '@/core/scheduling';
import { captureException } from '@/services/sentry';

// ─── Configuration ───────────────────────────────────

const PILL_CATEGORY_ID = 'pill_reminder';
const ACTION_TOOK_IT = 'took_it';
const ACTION_SNOOZE = 'snooze';
const SNOOZE_MINUTES = 15;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Register the action category once at module load. setNotificationCategoryAsync
// is idempotent — calling it on every launch is fine and ensures the buttons
// stay registered after OS settings churn.
let _categoryRegistered = false;
async function ensureCategoryRegistered(): Promise<void> {
  if (_categoryRegistered) return;
  try {
    await Notifications.setNotificationCategoryAsync(PILL_CATEGORY_ID, [
      {
        identifier: ACTION_TOOK_IT,
        buttonTitle: 'Took it',
        options: { opensAppToForeground: true },
      },
      {
        identifier: ACTION_SNOOZE,
        buttonTitle: `Snooze ${SNOOZE_MINUTES}min`,
        options: { opensAppToForeground: true },
      },
    ]);
    _categoryRegistered = true;
  } catch (error) {
    captureException(error);
  }
}

// ─── Permissions ─────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function hasNotificationPermissions(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

// ─── Internal: grouping helpers ───────────────────────

interface ReminderGroup {
  // One of:
  //   "daily-08:00"          → DAILY trigger at 08:00
  //   "weekly-3-08:00"       → WEEKLY trigger on weekday=3 at 08:00
  //   "interval-<pillId>"    → DATE trigger for next occurrence (per-pill)
  key: string;
  trigger: Notifications.NotificationTriggerInput;
  pills: Pill[];
}

function buildGroups(pills: Pill[]): ReminderGroup[] {
  const groups = new Map<string, ReminderGroup>();
  const now = new Date();

  for (const pill of pills) {
    if (pill.pillType !== 'scheduled' || !pill.isActive || !pill.schedule) continue;
    const schedule = pill.schedule;
    const [hours, minutes] = schedule.timeOfDay.split(':').map(Number);

    if (schedule.frequency === 'daily') {
      const key = `daily-${schedule.timeOfDay}`;
      addToGroup(groups, key, pill, {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hours,
        minute: minutes,
      });
      continue;
    }

    if (schedule.frequency === 'specific_days' && schedule.daysOfWeek?.length) {
      for (const weekday of schedule.daysOfWeek) {
        const key = `weekly-${weekday}-${schedule.timeOfDay}`;
        addToGroup(groups, key, pill, {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: weekday + 1, // expo: 1=Sun, our data: 0=Sun
          hour: hours,
          minute: minutes,
        });
      }
      continue;
    }

    if (schedule.frequency === 'every_n_days' && schedule.intervalDays) {
      // expo-notifications has no "every N days" repeating trigger that lines
      // up with a wall-clock time, so we schedule a one-shot DATE trigger for
      // the next occurrence. The dashboard re-runs scheduleAllPillReminders
      // whenever pills/doses change, which re-schedules the next one.
      const next = nextScheduledDose(schedule, now);
      const key = `interval-${pill.id}-${next.getTime()}`;
      groups.set(key, {
        key,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: next,
        },
        pills: [pill],
      });
    }
  }

  return Array.from(groups.values());
}

function addToGroup(
  groups: Map<string, ReminderGroup>,
  key: string,
  pill: Pill,
  trigger: Notifications.NotificationTriggerInput,
): void {
  const existing = groups.get(key);
  if (existing) {
    existing.pills.push(pill);
  } else {
    groups.set(key, { key, trigger, pills: [pill] });
  }
}

function buildBody(pills: Pill[]): string {
  if (pills.length === 1) {
    const p = pills[0];
    return `${p.drugName} ${p.dosageMg}${p.dosageUnit}`;
  }
  return `Time to take ${pills.map((p) => p.drugName).join(', ')}`;
}

// ─── Schedule Pill Reminders ─────────────────────────

/**
 * Cancel + re-schedule every pill reminder. Idempotent — call this whenever
 * the pill list changes.
 *
 * If `settings?.autoAssumeTaken` is true, we cancel existing reminders and
 * skip scheduling new ones. The dashboard's foreground-reconcile path
 * (Step E) writes dose records on the user's behalf instead.
 */
export async function scheduleAllPillReminders(
  pills: Pill[],
  settings?: Pick<UserSettings, 'autoAssumeTaken' | 'notificationsEnabled'>,
): Promise<void> {
  try {
    await ensureCategoryRegistered();

    // Always clear old pill reminders before deciding what to re-schedule —
    // catches the case where a user toggled autoAssumeTaken on while
    // reminders were already pending.
    await cancelAllPillReminders();

    if (settings?.autoAssumeTaken) return;
    if (settings?.notificationsEnabled === false) return;

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    const groups = buildGroups(pills);
    for (const group of groups) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title:
            group.pills.length === 1
              ? 'Time for your medication'
              : 'Time for your medications',
          body: buildBody(group.pills),
          data: {
            type: 'pill_reminder',
            pillIds: group.pills.map((p) => p.id),
          },
          categoryIdentifier: PILL_CATEGORY_ID,
        },
        trigger: group.trigger,
      });
    }
  } catch (error) {
    captureException(error);
  }
}

/**
 * Cancel every scheduled notification with `data.type === 'pill_reminder'`.
 * Leaves non-pill notifications (none today, but reserved for future use)
 * untouched.
 */
async function cancelAllPillReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.data?.type === 'pill_reminder') {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

/**
 * Cancel scheduled notifications that reference a specific pill. With
 * grouped notifications this can over-cancel (a daily-08:00 group covering
 * three pills is cancelled if any one of them is removed), but the
 * dashboard immediately calls `scheduleAllPillReminders` on the pill-list
 * change, which rebuilds the group cleanly without the removed pill.
 */
export async function cancelPillReminders(pillId: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    const data = notif.content.data;
    if (!data || data.type !== 'pill_reminder') continue;
    const ids: string[] = Array.isArray(data.pillIds)
      ? (data.pillIds as string[])
      : data.pillId
        ? [data.pillId as string]
        : [];
    if (ids.includes(pillId)) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

/**
 * Cancel all scheduled notifications. Used on sign-out.
 */
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ─── Notification Response Handling ──────────────────

export type NotificationAction = 'took_it' | 'default';

export type NotificationResponseHandler = (
  pillIds: string[],
  action: NotificationAction,
) => void;

let responseHandler: NotificationResponseHandler | null = null;

export function setNotificationResponseHandler(handler: NotificationResponseHandler): () => void {
  responseHandler = handler;

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    void handleResponse(response);
  });

  return () => {
    subscription.remove();
    responseHandler = null;
  };
}

async function handleResponse(response: Notifications.NotificationResponse): Promise<void> {
  const data = response.notification.request.content.data;
  if (!data || data.type !== 'pill_reminder') return;

  const pillIds: string[] = Array.isArray(data.pillIds)
    ? (data.pillIds as string[])
    : data.pillId
      ? [data.pillId as string]
      : [];
  if (pillIds.length === 0) return;

  const actionId = response.actionIdentifier;

  if (actionId === ACTION_SNOOZE) {
    await snoozeReminder(response.notification.request.content);
    return;
  }

  // Both ACTION_TOOK_IT and the default tap dispatch as 'took_it'/'default'.
  // Default tap is treated as a soft confirmation: open the app, let the
  // dashboard decide whether to record or just navigate.
  const action: NotificationAction =
    actionId === ACTION_TOOK_IT ? 'took_it' : 'default';
  if (responseHandler) responseHandler(pillIds, action);
}

async function snoozeReminder(content: Notifications.NotificationContent): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: content.title ?? 'Time for your medication',
        body: content.body ?? '',
        data: content.data,
        categoryIdentifier: PILL_CATEGORY_ID,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: SNOOZE_MINUTES * 60,
        repeats: false,
      },
    });
  } catch (error) {
    captureException(error);
  }
}

