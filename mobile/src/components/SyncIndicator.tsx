import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable } from "react-native";
import { useApp } from "@/providers/app";
import { TOUCH_TARGET, useTheme } from "@/theme";
import { Text } from "./Text";

/** Header control showing sync state as icon + words; tapping syncs now. */
export function SyncIndicator() {
  const { authState, syncStatus, online, syncNow } = useApp();
  const { colors } = useTheme();
  if (authState === "local_only") return null;

  let icon: "cloud-done-outline" | "cloud-offline-outline" | "sync-outline" | "alert-circle-outline" | "cloud-upload-outline";
  let label: string;
  let color = colors.textMuted;
  const pending = syncStatus?.pending ?? 0;
  if (!online) {
    icon = "cloud-offline-outline";
    label = pending ? `Offline · ${pending}` : "Offline";
  } else if (syncStatus?.state === "syncing") {
    icon = "sync-outline";
    label = "Syncing";
    color = colors.accent;
  } else if (syncStatus?.state === "error") {
    icon = "alert-circle-outline";
    label = "Sync issue";
    color = colors.warning;
  } else if (pending > 0) {
    icon = "cloud-upload-outline";
    label = `${pending} to sync`;
  } else {
    icon = "cloud-done-outline";
    label = "Synced";
  }

  return (
    <Pressable
      testID="sync-indicator"
      accessibilityRole="button"
      accessibilityLabel={`Sync status: ${label}`}
      accessibilityHint="Syncs now"
      onPress={() => syncNow()}
      style={{ minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8 }}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text variant="caption" color={color}>
        {label}
      </Text>
    </Pressable>
  );
}
