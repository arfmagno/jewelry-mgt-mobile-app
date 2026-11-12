import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { TOUCH_TARGET, useTheme } from "@/theme";
import { Text } from "./Text";

export type IconName = ComponentProps<typeof Ionicons>["name"];

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  hint?: string;
  style?: ViewStyle;
  testID?: string;
};

export function Button({ label, onPress, variant = "primary", icon, disabled, busy, hint, style, testID }: ButtonProps) {
  const { colors, radius, space } = useTheme();
  const palette = {
    primary: { bg: colors.accent, fg: colors.onAccent, border: colors.accent },
    secondary: { bg: "transparent", fg: colors.accent, border: colors.accent },
    ghost: { bg: "transparent", fg: colors.text, border: "transparent" },
    danger: { bg: colors.danger, fg: colors.onDanger, border: colors.danger },
  }[variant];
  const inactive = disabled || busy;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: radius.md,
          paddingHorizontal: space.lg,
          opacity: inactive ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={20} color={palette.fg} /> : null}
          <Text variant="label" color={palette.fg} style={{ fontSize: 15 }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

type IconButtonProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  testID?: string;
};

/** Icon-only button; the label is announced by screen readers. */
export function IconButton({ icon, label, onPress, color, disabled, testID }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.icon, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={24} color={color ?? colors.accent} />
    </Pressable>
  );
}

/** Floating "add" action placed above the tab bar. */
export function Fab({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: colors.accent, borderRadius: radius.pill, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Ionicons name="add" size={24} color={colors.onAccent} />
      <Text variant="label" color={colors.onAccent}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: TOUCH_TARGET,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: "center", justifyContent: "center" },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    minHeight: 56,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
