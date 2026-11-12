import { monthlySummary } from "@jewelry/core";
import { formatMoney } from "@jewelry/shared";
import { useState } from "react";
import { View } from "react-native";
import { IconButton } from "@/components/Button";
import { Card, Columns, Detail, EmptyState, Screen } from "@/components/layout";
import { Text } from "@/components/Text";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { percent } from "@/lib/format";
import { useTheme } from "@/theme";

const monthName = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString(undefined, { month: "long" });

export default function ReportsScreen() {
  const { colors, radius } = useTheme();
  const [year, setYear] = useState(new Date().getFullYear());
  const { data } = useLiveQuery((s) => monthlySummary(s, year), [year]);
  const months = data ?? [];
  const total = months.reduce(
    (t, m) => ({ orders: t.orders + m.orders, selling: t.selling + m.selling, cost: t.cost + m.cost, profit: t.profit + m.profit, paid: t.paid + m.paid }),
    { orders: 0, selling: 0, cost: 0, profit: 0, paid: 0 },
  );
  const max = Math.max(1, ...months.map((m) => m.selling));

  return (
    <Screen testID="reports">
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
        <IconButton icon="chevron-back" label={`Show ${year - 1}`} onPress={() => setYear(year - 1)} />
        <Text variant="title" accessibilityLiveRegion="polite" style={{ minWidth: 100, textAlign: "center" }}>
          {year}
        </Text>
        <IconButton icon="chevron-forward" label={`Show ${year + 1}`} onPress={() => setYear(year + 1)} disabled={year >= new Date().getFullYear()} />
      </View>
      <Columns>
        <Card>
          <Detail label="Orders" value={String(total.orders)} />
          <Detail label="Sales" value={<Text variant="money">{formatMoney(total.selling)}</Text>} />
          <Detail label="Collected" value={<Text variant="money">{formatMoney(total.paid)}</Text>} />
        </Card>
        <Card>
          <Detail label="Cost" value={<Text variant="money">{formatMoney(total.cost)}</Text>} />
          <Detail label="Profit" value={<Text variant="money" color={colors.accent}>{formatMoney(total.profit)}</Text>} />
          <Detail label="Margin" value={percent(total.selling ? total.profit / total.selling : null)} />
        </Card>
      </Columns>
      {months.length === 0 ? (
        <EmptyState icon="bar-chart-outline" title={`No orders in ${year}`} />
      ) : (
        months.map((m) => (
          <Card key={m.month}>
            <View
              accessible
              accessibilityLabel={`${monthName(m.month)}: ${m.orders} orders, sales ${formatMoney(m.selling)}, profit ${formatMoney(m.profit)}, collected ${formatMoney(m.paid)}`}
              style={{ gap: 6 }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <Text variant="heading">{monthName(m.month)}</Text>
                <Text variant="money">{formatMoney(m.selling)}</Text>
              </View>
              {/* Bar shows sales relative to the best month; exact figures are in the text. */}
              <View style={{ height: 8, backgroundColor: colors.divider, borderRadius: radius.pill, overflow: "hidden" }}>
                <View style={{ width: `${(m.selling / max) * 100}%`, height: "100%", backgroundColor: colors.accent }} />
              </View>
              <Text variant="caption" muted>
                {m.orders} order(s) · profit {formatMoney(m.profit)} · collected {formatMoney(m.paid)}
              </Text>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
