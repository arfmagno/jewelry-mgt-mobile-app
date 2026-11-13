import { formatMoney } from "@jewelry/shared";
import { useState } from "react";
import { Alert } from "react-native";
import { DateField } from "@/components/fields";
import { clearReminder, getReminder, reminderTime, setReminder } from "@/lib/reminders";

/** A day to be reminded to collect the balance; a notification arrives at 9 AM and opens the order. */
export function ReminderField({ orderId, code, client, balance }: { orderId: string; code: string; client: string; balance: number }) {
  const [date, setDate] = useState(() => getReminder(orderId)?.date ?? null);

  const change = async (next: string | null) => {
    if (!next) {
      await clearReminder(orderId);
      setDate(null);
      return;
    }
    if (reminderTime(next) <= new Date()) {
      Alert.alert("Choose a later day", "Reminders arrive at 9 AM, so pick a day that hasn't reached 9 AM yet.");
      return;
    }
    const ok = await setReminder(orderId, next, {
      title: `Collect ${formatMoney(balance)}`,
      body: `${client} · ${code}`,
    }).catch(() => false);
    if (!ok) {
      Alert.alert("Notifications are off", "Allow notifications for Hiyas in your phone's settings to get reminders.");
      return;
    }
    setDate(next);
  };

  return (
    <DateField
      label="Remind me to collect"
      hint={date ? "You'll get a notification at 9 AM that day." : "Pick a day to get a notification about this balance."}
      value={date}
      allowClear
      onChange={(d) => void change(d)}
    />
  );
}
