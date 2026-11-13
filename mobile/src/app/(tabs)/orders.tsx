import { listOrders, orderMonths, type OrderSummary } from "@jewelry/core";
import { formatMoney } from "@jewelry/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { SectionList, View } from "react-native";
import { Button, Fab } from "@/components/Button";
import { TextField } from "@/components/fields";
import { FilterBar } from "@/components/FilterBar";
import { EmptyState } from "@/components/layout";
import { Text } from "@/components/Text";
import { monthLabel, MonthNavigator, thisMonth } from "@/features/orders/MonthNavigator";
import { OrderRow } from "@/features/orders/OrderRow";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { MAX_CONTENT_WIDTH, useLayout, useTheme } from "@/theme";

type Show = "in_production" | "completed" | "unpaid";
const PAGE = 100;

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

/** Groups orders under a heading per day (one month) or per month (search results). */
function group(orders: OrderSummary[], by: "day" | "month") {
  const sections: { title: string; data: OrderSummary[] }[] = [];
  for (const o of orders) {
    const title = by === "day" ? dayLabel(o.orderDate) : monthLabel(o.orderDate.slice(0, 7));
    const last = sections.at(-1);
    if (last?.title === title) last.data.push(o);
    else sections.push({ title, data: [o] });
  }
  return sections;
}

export default function OrdersScreen() {
  const router = useRouter();
  const { colors, radius } = useTheme();
  const { gutter } = useLayout();
  const [search, setSearch] = useState("");
  const [show, setShow] = useState<Show | null>(null);
  const [chosenMonth, setChosenMonth] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const { data: months } = useLiveQuery((s) => orderMonths(s), []);
  // Until a month is chosen, open on the newest month with orders.
  const month = chosenMonth ?? months?.[0]?.month ?? thisMonth();
  const searching = search.trim() !== "";
  const { data, loading } = useLiveQuery(
    (s) =>
      listOrders(s, {
        search,
        month: searching ? undefined : month,
        status: show === "in_production" || show === "completed" ? show : undefined,
        unpaid: show === "unpaid",
        limit,
      }),
    [search, month, show, limit, searching],
  );
  const summary = months?.find((m) => m.month === month);
  const pickMonth = (m: string) => {
    setChosenMonth(m);
    setLimit(PAGE);
  };

  const header = (
    <View style={{ gap: 16, paddingBottom: 8 }}>
      <TextField label="Search all orders" value={search} onChangeText={setSearch} placeholder="Code or client name" autoCorrect={false} />
      {searching ? null : (
        <>
          <MonthNavigator month={month} months={months ?? []} onChange={pickMonth} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              ["Orders", String(summary?.orders ?? 0)],
              ["Sales", formatMoney(summary?.selling ?? 0)],
              ["To collect", formatMoney(summary?.balance ?? 0)],
            ].map(([label, value]) => (
              <View
                key={label}
                accessible
                accessibilityLabel={`${label}: ${value}`}
                style={{ flex: 1, padding: 12, gap: 2, borderRadius: radius.md, backgroundColor: colors.accentSoft }}
              >
                <Text variant="caption" muted>
                  {label}
                </Text>
                <Text variant="money" style={{ fontSize: 15 }}>
                  {value}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
      <FilterBar
        label="Show"
        value={show}
        onChange={(v) => {
          setShow(v);
          setLimit(PAGE);
        }}
        filters={[
          { value: "in_production", label: "In production" },
          { value: "completed", label: "Completed" },
          { value: "unpaid", label: "To collect" },
        ]}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SectionList
        testID="order-list"
        sections={group(data ?? [], searching ? "month" : "day")}
        keyExtractor={(o) => o.id}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 16, paddingBottom: 96, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}
        renderSectionHeader={({ section }) => (
          <Text variant="label" muted accessibilityRole="header" style={{ backgroundColor: colors.background, paddingTop: 12, paddingBottom: 6 }}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <View style={{ paddingBottom: 8 }}>
            <OrderRow order={item} onPress={() => router.push(`/orders/${item.id}`)} />
          </View>
        )}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if ((data?.length ?? 0) >= limit) setLimit((l) => l + PAGE);
        }}
        ListEmptyComponent={
          loading ? undefined : (
            <EmptyState
              icon="receipt-outline"
              title={searching ? "No matching orders" : months?.length ? `No orders in ${monthLabel(month)}` : "No job orders yet"}
              body={searching ? "Search looks through every month." : undefined}
              action={
                !searching && months?.length && month !== months[0]!.month ? (
                  <Button label={`Go to ${monthLabel(months[0]!.month)}`} variant="secondary" onPress={() => pickMonth(months[0]!.month)} />
                ) : undefined
              }
            />
          )
        }
      />
      <Fab testID="add-order" label="New order" onPress={() => router.push("/orders/edit")} />
    </View>
  );
}
