import Ionicons from "@expo/vector-icons/Ionicons";
import type { OrderMonth } from "@jewelry/core";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconButton } from "@/components/Button";
import { Text } from "@/components/Text";
import { TOUCH_TARGET, useModalAnimation, useTheme } from "@/theme";

/** "2026-03" ± n months. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** The current month in local time. */
export function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string, style: "long" | "short" = "long"): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: style, year: style === "long" ? "numeric" : undefined });
}

/** Previous / next month, with the month name opening a picker of every month that has orders. */
export function MonthNavigator({
  month,
  months,
  onChange,
}: {
  month: string;
  months: OrderMonth[];
  onChange: (month: string) => void;
}) {
  const { colors, radius } = useTheme();
  const animation = useModalAnimation();
  const [open, setOpen] = useState(false);
  const earliest = months.at(-1)?.month ?? month;
  const latest = [months[0]?.month ?? month, thisMonth()].sort().at(-1)!;
  const counts = new Map(months.map((m) => [m.month, m.orders]));
  const years = [...new Set([...months.map((m) => m.month.slice(0, 4)), month.slice(0, 4)])].sort().reverse();

  return (
    <View style={styles.row}>
      <IconButton icon="chevron-back" label="Previous month" disabled={month <= earliest} onPress={() => onChange(shiftMonth(month, -1))} />
      <Pressable
        testID="month-picker"
        accessibilityRole="button"
        accessibilityLabel={`${monthLabel(month)}. Choose a month`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.title, { borderRadius: radius.md, backgroundColor: pressed ? colors.accentSoft : "transparent" }]}
      >
        <Text variant="title">{monthLabel(month)}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.accent} />
      </Pressable>
      <IconButton icon="chevron-forward" label="Next month" disabled={month >= latest} onPress={() => onChange(shiftMonth(month, 1))} />

      <Modal visible={open} animationType={animation} onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.header, { borderColor: colors.divider }]}>
            <Text variant="heading" style={{ flex: 1 }}>
              Choose a month
            </Text>
            <IconButton icon="close" label="Close" onPress={() => setOpen(false)} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
            {years.map((year) => (
              <View key={year} style={{ gap: 8 }}>
                <Text variant="heading">{year}</Text>
                <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={year}>
                  {Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`).map((m) => {
                    const count = counts.get(m) ?? 0;
                    const selected = m === month;
                    const future = m > latest;
                    return (
                      <Pressable
                        key={m}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected, disabled: future }}
                        accessibilityLabel={`${monthLabel(m)}, ${count} ${count === 1 ? "order" : "orders"}`}
                        disabled={future}
                        onPress={() => {
                          onChange(m);
                          setOpen(false);
                        }}
                        style={[
                          styles.cell,
                          {
                            borderRadius: radius.md,
                            borderWidth: selected ? 2 : 1,
                            borderColor: selected ? colors.accent : colors.divider,
                            backgroundColor: selected ? colors.accentSoft : count ? colors.surface : "transparent",
                            opacity: future ? 0.4 : 1,
                          },
                        ]}
                      >
                        <Text variant="label" color={count ? colors.text : colors.textMuted}>
                          {monthLabel(m, "short")}
                        </Text>
                        <Text variant="caption" color={count ? colors.accent : colors.textMuted}>
                          {count ? `${count} ${count === 1 ? "order" : "orders"}` : "—"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  title: { flex: 1, minHeight: TOUCH_TARGET, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { width: "31%", flexGrow: 1, minHeight: TOUCH_TARGET + 16, alignItems: "center", justifyContent: "center", padding: 8 },
});
