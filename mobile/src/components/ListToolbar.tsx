import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";
import { TOUCH_TARGET, useTheme } from "@/theme";
import type { IconName } from "./Button";
import { Text } from "./Text";

export type ToolbarAction = {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** Panel open or option on: drawn filled. */
  active?: boolean;
  /** Number of filters applied, shown as a badge. */
  count?: number;
  testID?: string;
};

/** A one-line summary of what the list shows, with icon buttons that open search, filters and view options. */
export function ListToolbar({ summary, actions }: { summary: string; actions: ToolbarAction[] }) {
  const { colors, radius } = useTheme();
  return (
    <View style={styles.row}>
      <Text variant="label" muted style={{ flex: 1 }} accessibilityLiveRegion="polite">
        {summary}
      </Text>
      {actions.map((a) => (
        <Pressable
          key={a.label}
          testID={a.testID}
          accessibilityRole="button"
          accessibilityLabel={a.count ? `${a.label}, ${a.count} applied` : a.label}
          accessibilityState={a.active === undefined ? undefined : { expanded: a.active }}
          onPress={a.onPress}
          style={({ pressed }) => [
            styles.button,
            { borderRadius: radius.pill, backgroundColor: a.active ? colors.accent : pressed ? colors.accentSoft : "transparent" },
          ]}
        >
          <Ionicons name={a.icon} size={22} color={a.active ? colors.onAccent : colors.accent} />
          {a.count ? (
            <View style={[styles.badge, { backgroundColor: colors.accent, borderColor: colors.background }]}>
              <Text variant="caption" color={colors.onAccent} style={{ fontSize: 11, lineHeight: 14 }}>
                {a.count}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: TOUCH_TARGET },
  button: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
});
