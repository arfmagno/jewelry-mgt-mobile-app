import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { TOUCH_TARGET, useTheme } from "@/theme";
import { Text } from "./Text";

export type Filter<V extends string> = { value: V; label: string; art?: (selected: boolean) => ReactNode };

/** One-tap filters in a horizontally scrolling row; "All" clears the filter. */
export function FilterBar<V extends string>({
  label,
  filters,
  value,
  onChange,
  allLabel = "All",
}: {
  label: string;
  filters: Filter<V>[];
  value: V | null;
  onChange: (v: V | null) => void;
  allLabel?: string;
}) {
  const { colors, radius } = useTheme();
  const chip = (key: string, text: string, selected: boolean, onPress: () => void, art?: ReactNode) => (
    <Pressable
      key={key}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={text}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: TOUCH_TARGET,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingLeft: art ? 8 : 16,
        paddingRight: 16,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.divider,
        backgroundColor: selected ? colors.accent : pressed ? colors.accentSoft : colors.surface,
      })}
    >
      {art}
      <Text variant="label" color={selected ? colors.onAccent : colors.text}>
        {text}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        contentContainerStyle={{ gap: 8 }}
      >
        {chip("__all", allLabel, value === null, () => onChange(null))}
        {filters.map((f) => {
          const selected = f.value === value;
          return chip(f.value, f.label, selected, () => onChange(selected ? null : f.value), f.art?.(selected));
        })}
      </ScrollView>
    </View>
  );
}
