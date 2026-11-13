import { Storage } from "expo-sqlite/kv-store";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { useRouter, type Href } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * Reminders to collect a balance: a notification on the phone on a chosen day,
 * which opens the order when tapped. They live on this device only, like the
 * appearance setting, and are never synced.
 */

export type Reminder = { notificationId: string; date: string };

const CHANNEL = "payment-reminders";
const key = (orderId: string) => `reminder.${orderId}`;
/** Reminders arrive at 9 in the morning. */
const HOUR = 9;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export function getReminder(orderId: string): Reminder | null {
  try {
    const raw = Storage.getItemSync(key(orderId));
    const r = raw ? (JSON.parse(raw) as Reminder) : null;
    // A reminder whose day has passed has already been shown.
    return r && reminderTime(r.date) > new Date() ? r : null;
  } catch {
    return null;
  }
}

export const reminderTime = (date: string) => new Date(`${date}T${String(HOUR).padStart(2, "0")}:00:00`);

/** Schedules (or moves) the reminder for an order. Returns false when notifications aren't allowed. */
export async function setReminder(orderId: string, date: string, message: { title: string; body: string }): Promise<boolean> {
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: "Payment reminders", importance: AndroidImportance.DEFAULT });
  }
  await clearReminder(orderId);
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: { ...message, data: { url: `/orders/${orderId}` } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderTime(date), channelId: CHANNEL },
  });
  Storage.setItemSync(key(orderId), JSON.stringify({ notificationId, date } satisfies Reminder));
  return true;
}

export async function clearReminder(orderId: string): Promise<void> {
  const r = getReminderRaw(orderId);
  if (r) await Notifications.cancelScheduledNotificationAsync(r.notificationId).catch(() => undefined);
  try {
    Storage.removeItemSync(key(orderId));
  } catch {
    // Nothing stored.
  }
}

function getReminderRaw(orderId: string): Reminder | null {
  try {
    const raw = Storage.getItemSync(key(orderId));
    return raw ? (JSON.parse(raw) as Reminder) : null;
  } catch {
    return null;
  }
}

/** Opens the order when a reminder is tapped, including when it starts the app. */
export function useReminderLinks() {
  const router = useRouter();
  useEffect(() => {
    const open = (r: Notifications.NotificationResponse | null) => {
      const url = r?.notification.request.content.data?.url;
      if (typeof url === "string" && url.startsWith("/orders/")) router.push(url as Href);
    };
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [router]);
}
