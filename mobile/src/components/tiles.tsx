import Ionicons from "@expo/vector-icons/Ionicons";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { TOUCH_TARGET, useTheme } from "@/theme";
import { FieldChrome } from "./fields";
import { Text } from "./Text";

export type Tile<V extends string> = {
  value: V;
  label: string;
  caption?: string;
  /** Illustration, drawn larger and in full colour when selected. */
  art: (selected: boolean) => ReactNode;
};

type GridProps<V extends string> = {
  label: string;
  tiles: Tile<V>[];
  isSelected: (v: V) => boolean;
  onPress: (v: V) => void;
  multi: boolean;
  minTileWidth: number;
  hint?: string;
  error?: string | null;
  testIDPrefix?: string;
};

/** Illustrated choices in a responsive grid: radios for one choice, checkboxes for several. */
function TileGrid<V extends string>({ label, tiles, isSelected, onPress, multi, minTileWidth, hint, error, testIDPrefix }: GridProps<V>) {
  const { colors, radius } = useTheme();
  const [width, setWidth] = useState(0);
  const gap = 10;
  const columns = Math.max(2, Math.min(tiles.length, Math.floor((width + gap) / (minTileWidth + gap)) || 2));
  const tileWidth = width ? (width - gap * (columns - 1)) / columns : undefined;

  return (
    <FieldChrome label={label} hint={hint} error={error}>
      <View
        accessibilityRole={multi ? undefined : "radiogroup"}
        accessibilityLabel={label}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.grid, { gap }]}
      >
        {tiles.map((t) => {
          const selected = isSelected(t.value);
          return (
            <Pressable
              key={t.value}
              testID={testIDPrefix ? `${testIDPrefix}-${t.value}` : undefined}
              accessibilityRole={multi ? "checkbox" : "radio"}
              accessibilityState={{ checked: selected }}
              accessibilityLabel={[t.label, t.caption].filter(Boolean).join(", ")}
              onPress={() => onPress(t.value)}
              style={({ pressed }) => [
                styles.tile,
                {
                  width: tileWidth,
                  borderRadius: radius.md,
                  borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
                  borderColor: selected ? colors.ink : colors.border,
                  backgroundColor: colors.surface,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {selected ? (
                <View style={[styles.check, { backgroundColor: colors.ink }]}>
                  <Ionicons name="checkmark" size={14} color={colors.onInk} />
                </View>
              ) : null}
              {t.art(selected)}
              <Text variant="eyebrow" align="center" color={selected ? colors.text : colors.textMuted}>
                {t.label}
              </Text>
              {t.caption ? (
                <Text variant="caption" align="center" muted>
                  {t.caption}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </FieldChrome>
  );
}

export function TilePicker<V extends string>({
  value,
  onChange,
  allowClear,
  minTileWidth = 96,
  ...rest
}: Omit<GridProps<V>, "isSelected" | "onPress" | "multi" | "minTileWidth"> & {
  value: V | null;
  onChange: (v: V | null) => void;
  allowClear?: boolean;
  minTileWidth?: number;
}) {
  return (
    <TileGrid
      {...rest}
      multi={false}
      minTileWidth={minTileWidth}
      isSelected={(v) => v === value}
      onPress={(v) => onChange(v === value && allowClear ? null : v)}
    />
  );
}

export function TileMultiPicker<V extends string>({
  values,
  onToggle,
  minTileWidth = 96,
  ...rest
}: Omit<GridProps<V>, "isSelected" | "onPress" | "multi" | "minTileWidth"> & {
  values: readonly V[];
  onToggle: (v: V) => void;
  minTileWidth?: number;
}) {
  return <TileGrid {...rest} multi minTileWidth={minTileWidth} isSelected={(v) => values.includes(v)} onPress={onToggle} />;
}

/** Progress through a multi-step form; finished or reachable steps can be revisited. */
export function StepIndicator({
  steps,
  current,
  canOpen,
  onOpen,
}: {
  steps: { key: string; label: string }[];
  current: number;
  canOpen: (index: number) => boolean;
  onOpen: (index: number) => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <View style={styles.steps}>
        {steps.map((s, i) => {
          const state = i < current ? "done" : i === current ? "current" : "todo";
          const enabled = i !== current && canOpen(i);
          return (
            <Pressable
              key={s.key}
              testID={`step-${s.key}`}
              accessibilityRole="button"
              accessibilityLabel={`Step ${i + 1} of ${steps.length}, ${s.label}${state === "current" ? ", current step" : state === "done" ? ", done" : ""}`}
              accessibilityState={{ disabled: !enabled, selected: state === "current" }}
              disabled={!enabled}
              onPress={() => onOpen(i)}
              style={styles.stepHit}
            >
              <View
                style={{
                  height: state === "current" ? 3 : 2,
                  borderRadius: radius.pill,
                  backgroundColor: state === "todo" ? colors.divider : state === "current" ? colors.ink : colors.gold,
                }}
              />
            </Pressable>
          );
        })}
      </View>
      <Text variant="caption" muted>
        Step {current + 1} of {steps.length}
      </Text>
    </View>
  );
}

/** Whole-number counter with − and + buttons; screen readers adjust it by swiping up or down. */
export function CountField({
  label,
  value,
  onChange,
  min = 1,
  max = 9999,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const { colors, radius } = useTheme();
  const button = (icon: "remove" | "add", next: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={icon === "add" ? `Increase ${label}` : `Decrease ${label}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onChange(next)}
      style={({ pressed }) => [
        styles.countButton,
        { borderRadius: radius.md, borderColor: colors.border, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={22} color={colors.accent} />
    </Pressable>
  );
  return (
    <FieldChrome label={label}>
      <View
        style={styles.count}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ now: value, min, max }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "increment" && value < max) onChange(value + 1);
          if (e.nativeEvent.actionName === "decrement" && value > min) onChange(value - 1);
        }}
      >
        {button("remove", value - 1, value <= min)}
        <Text variant="money" style={{ minWidth: 48, fontSize: 20 }} align="center">
          {value}
        </Text>
        {button("add", value + 1, value >= max)}
      </View>
    </FieldChrome>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap" },
  tile: { minHeight: TOUCH_TARGET * 2, paddingVertical: 12, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", gap: 6 },
  check: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  steps: { flexDirection: "row", gap: 6 },
  stepHit: { flex: 1, minHeight: TOUCH_TARGET, justifyContent: "center" },
  count: { flexDirection: "row", alignItems: "center", gap: 8 },
  countButton: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
