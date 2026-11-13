import Ionicons from "@expo/vector-icons/Ionicons";
import type { OrderMonth, OrderYear } from "@jewelry/core";
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

export type Period = { by: "month"; month: string } | { by: "year"; year: string };

export const periodLabel = (p: Period) => (p.by === "month" ? monthLabel(p.month) : p.year);

/**
 * Previous / next month or year, with the title opening a picker: tap a month
 * for that month, or a year's heading for the whole year.
 */
export function PeriodNavigator({
  period,
  months,
  years,
  onChange,
}: {
  period: Period;
  months: OrderMonth[];
  years: OrderYear[];
  onChange: (period: Period) => void;
}) {
  const { colors, radius } = useTheme();
  const animation = useModalAnimation();
  const [open, setOpen] = useState(false);
  const now = thisMonth();
  const shown = period.by === "month" ? period.month : period.year;
  const earliest = period.by === "month" ? (months.at(-1)?.month ?? shown) : (years.at(-1)?.year ?? shown);
  const latest = [period.by === "month" ? (months[0]?.month ?? shown) : (years[0]?.year ?? shown), period.by === "month" ? now : now.slice(0, 4)].sort().at(-1)!;
  const step = (by: number) =>
    onChange(period.by === "month" ? { by: "month", month: shiftMonth(period.month, by) } : { by: "year", year: String(Number(period.year) + by) });
  const monthCounts = new Map(months.map((m) => [m.month, m.orders]));
  const yearCounts = new Map(years.map((y) => [y.year, y.orders]));
  const allYears = [...new Set([...years.map((y) => y.year), shown.slice(0, 4)])].sort().reverse();
  const unit = period.by === "month" ? "month" : "year";
  const pick = (p: Period) => {
    onChange(p);
    setOpen(false);
  };

  return (
    <View style={styles.row}>
      <IconButton icon="chevron-back" label={`Previous ${unit}`} disabled={shown <= earliest} onPress={() => step(-1)} />
      <Pressable
        testID="period-picker"
        accessibilityRole="button"
        accessibilityLabel={`${periodLabel(period)}. Choose a month or year`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.title, { borderRadius: radius.md, backgroundColor: pressed ? colors.accentSoft : "transparent" }]}
      >
        <Text variant="title">{periodLabel(period)}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.accent} />
      </Pressable>
      <IconButton icon="chevron-forward" label={`Next ${unit}`} disabled={shown >= latest} onPress={() => step(1)} />

      <Modal visible={open} animationType={animation} onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.header, { borderColor: colors.divider }]}>
            <Text variant="heading" style={{ flex: 1 }}>
              Choose a month or year
            </Text>
            <IconButton icon="close" label="Close" onPress={() => setOpen(false)} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
            {allYears.map((year) => {
              const yearCount = yearCounts.get(year) ?? 0;
              const yearSelected = period.by === "year" && period.year === year;
              return (
                <View key={year} style={{ gap: 8 }}>
                  <Pressable
                    testID={`pick-year-${year}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: yearSelected }}
                    accessibilityLabel={`Whole of ${year}, ${yearCount} ${yearCount === 1 ? "order" : "orders"}`}
                    onPress={() => pick({ by: "year", year })}
                    style={[
                      styles.yearRow,
                      {
                        borderRadius: radius.md,
                        borderWidth: yearSelected ? 2 : StyleSheet.hairlineWidth,
                        borderColor: yearSelected ? colors.accent : colors.divider,
                        backgroundColor: yearSelected ? colors.accentSoft : colors.surface,
                      },
                    ]}
                  >
                    <Text variant="title" style={{ flex: 1 }}>
                      {year}
                    </Text>
                    <Text variant="eyebrow" color={colors.accent}>
                      Whole year · {yearCount}
                    </Text>
                  </Pressable>
                  <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={`Months of ${year}`}>
                    {Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`).map((m) => {
                      const count = monthCounts.get(m) ?? 0;
                      const selected = period.by === "month" && period.month === m;
                      const future = m > now;
                      return (
                        <Pressable
                          key={m}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected, disabled: future }}
                          accessibilityLabel={`${monthLabel(m)}, ${count} ${count === 1 ? "order" : "orders"}`}
                          disabled={future}
                          onPress={() => pick({ by: "month", month: m })}
                          style={[
                            styles.cell,
                            {
                              borderRadius: radius.md,
                              borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
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
              );
            })}
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
  yearRow: { minHeight: TOUCH_TARGET + 8, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 12 },
  cell: { width: "31%", flexGrow: 1, minHeight: TOUCH_TARGET + 16, alignItems: "center", justifyContent: "center", padding: 8 },
});
