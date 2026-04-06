/**
 * Local notification service using expo-notifications.
 * Schedules pill reminders based on PillSchedule.
 * Server-side push notifications will be added in a follow-up phase.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Pill } from '@/core/types';
import { captureException } from '@/services/sentry';

// ─── Configuration ───────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

// ─── Schedule Pill Reminders ─────────────────────────

/**
 * Schedule a daily notification for a pill.
 * Returns the notification identifier (for cancellation).
 */
export async function schedulePillReminder(pill: Pill): Promise<string | null> {
  if (!pill.schedule || !pill.isActive) return null;

  const [hours, minutes] = pill.schedule.timeOfDay.split(':').map(Number);

  // Cancel existing reminders for this pill first
  await cancelPillReminders(pill.id);

  if (pill.schedule.frequency === 'daily') {
    return Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time for your medication',
        body: `${pill.drugName} ${pill.dosageMg}${pill.dosageUnit}`,
        data: { pillId: pill.id, type: 'pill_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hours,
        minute: minutes,
      },
    });
  }

  if (pill.schedule.frequency === 'specific_days' && pill.schedule.daysOfWeek?.length) {
    // Schedule one notification per day of the week
    const ids: string[] = [];
    for (const weekday of pill.schedule.daysOfWeek) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Time for your medication',
          body: `${pill.drugName} ${pill.dosageMg}${pill.dosageUnit}`,
          data: { pillId: pill.id, type: 'pill_reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: weekday + 1, // expo uses 1=Sunday, our data uses 0=Sunday
          hour: hours,
          minute: minutes,
        },
      });
      ids.push(id);
    }
    return ids[0]; // Return first ID as reference
  }

  return null;
}

/**
 * Cancel all scheduled notifications for a specific pill.
 */
export async function cancelPillReminders(pillId: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.data?.pillId === pillId) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

/**
 * Cancel all scheduled notifications.
 */
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Schedule reminders for all active scheduled pills.
 */
export async function scheduleAllPillReminders(pills: Pill[]): Promise<void> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    for (const pill of pills) {
      if (pill.pillType === 'scheduled' && pill.isActive && pill.schedule) {
        await schedulePillReminder(pill);
      }
    }
  } catch (error) {
    captureException(error);
  }
}

// ─── Notification Response Handling ──────────────────

export type NotificationResponseHandler = (pillId: string) => void;

let responseHandler: NotificationResponseHandler | null = null;

export function setNotificationResponseHandler(handler: NotificationResponseHandler): () => void {
  responseHandler = handler;

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const pillId = response.notification.request.content.data?.pillId;
    if (pillId && responseHandler) {
      responseHandler(pillId as string);
    }
  });

  return () => {
    subscription.remove();
    responseHandler = null;
  };
}
