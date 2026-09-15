import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Reminders are scheduled on the device rather than pushed from the server:
// the event time is known when it is created, and local notifications still
// fire when the app is closed — and they work in Expo Go, which dropped remote
// push support.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const PREFIX = "flux-event-";

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

type ReminderEvent = { id: string; title: string; date: string; type?: string; course?: { name?: string } | null };

/**
 * Reconciles reminders with the events that exist now: every future event gets
 * exactly one reminder at its start time, and stale ones are dropped.
 *
 * `window` matters. Callers only ever hold the events for the range they are
 * showing, so without it a screen displaying one week would cancel the
 * reminders for everything outside that week. Cancellation is therefore limited
 * to reminders whose fire time falls inside the range the caller actually knows
 * about.
 */
export async function syncEventReminders(
  events: ReminderEvent[],
  window?: { from: Date | string; to: Date | string }
): Promise<void> {
  if (!(await ensureNotificationPermission())) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("events", {
      name: "Class schedule",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const ours = scheduled.filter(n => (n.identifier ?? "").startsWith(PREFIX));
  const alreadySet = new Set(ours.map(n => n.identifier));

  const now = Date.now();
  const upcoming = events.filter(e => new Date(e.date).getTime() > now + 5000);
  const wanted = new Map(upcoming.map(e => [PREFIX + e.id, e]));

  const from = window ? new Date(window.from).getTime() : -Infinity;
  const to = window ? new Date(window.to).getTime() : Infinity;
  const firesInWindow = (n: Notifications.NotificationRequest) => {
    const trigger: any = n.trigger;
    const at = trigger?.value ?? trigger?.date;
    if (at == null) return !window;              // unknown fire time: only touch it when reconciling everything
    const ms = typeof at === "number" ? at : new Date(at).getTime();
    return ms >= from && ms <= to;
  };

  // Drop reminders for events that were deleted, moved, or have passed —
  // but only within the range the caller can actually vouch for.
  await Promise.all(
    ours
      .filter(n => !wanted.has(n.identifier) && firesInWindow(n))
      .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
  );

  await Promise.all(
    [...wanted.entries()]
      .filter(([id]) => !alreadySet.has(id))
      .map(([id, e]) =>
        Notifications.scheduleNotificationAsync({
          identifier: id,
          content: {
            title: e.title,
            body: [e.type, e.course?.name].filter(Boolean).join(" · ") || "Starting now",
            sound: "default",
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(e.date),
            ...(Platform.OS === "android" ? { channelId: "events" } : {}),
          },
        }).catch(() => {})
      )
  );
}
