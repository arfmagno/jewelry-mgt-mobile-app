import { listOrders, orderCounts, orderMonths, orderYears, type OrderSummary } from "@jewelry/core";
import { formatMoney, ORDER_STATUSES, type JobOrder } from "@jewelry/shared";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, SectionList, StyleSheet, View } from "react-native";
import { Button } from "@/components/Button";
import { TextField } from "@/components/fields";
import { ListToolbar } from "@/components/ListToolbar";
import { EmptyState } from "@/components/layout";
import { TabSwipe, type SwipeDirection } from "@/components/TabSwipe";
import { Text } from "@/components/Text";
import { monthLabel, PeriodNavigator, periodLabel, thisMonth, type Period } from "@/features/orders/PeriodNavigator";
import { OrderRow } from "@/features/orders/OrderRow";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { MAX_CONTENT_WIDTH, TOUCH_TARGET, useLayout, useTheme } from "@/theme";

type Status = JobOrder["status"];
const PAGES: Status[] = ["in_production", "completed"];
const PAGE_SIZE = 100;

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

/** Groups orders under a heading per day (one month) or per month (longer spans). */
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
  const { colors } = useTheme();
  const { gutter } = useLayout();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [unpaid, setUnpaid] = useState(false);
  const { data: counts } = useLiveQuery((s) => orderCounts(s), []);

  // A sideways swipe moves between In production and Completed before leaving the tab.
  const onSwipe = useCallback(
    (dir: SwipeDirection) => {
      const to = page + (dir === "next" ? 1 : -1);
      if (to < 0 || to >= PAGES.length) return false;
      setPage(to);
      return true;
    },
    [page],
  );

  return (
    <TabSwipe tab="orders" onSwipe={onSwipe}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingHorizontal: gutter, paddingTop: 8, gap: 8, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}>
          <ListToolbar
            summary={unpaid ? "Orders with a balance to collect" : "All orders"}
            actions={[
              {
                icon: "search",
                label: searchOpen ? "Close search" : "Search orders",
                active: searchOpen,
                testID: "toggle-order-search",
                onPress: () => {
                  if (searchOpen) setSearch("");
                  setSearchOpen(!searchOpen);
                },
              },
              {
                icon: "cash-outline",
                label: unpaid ? "Show all orders" : "Show only orders to collect",
                active: unpaid,
                testID: "toggle-unpaid",
                onPress: () => setUnpaid(!unpaid),
              },
            ]}
          />
          {searchOpen ? (
            <TextField label="Search orders" value={search} onChangeText={setSearch} placeholder="Code or client name" autoCorrect={false} autoFocus />
          ) : null}
          <View accessibilityRole="tablist" style={[styles.tabs, { borderColor: colors.divider }]}>
            {PAGES.map((status, i) => {
              const selected = page === i;
              return (
                <Pressable
                  key={status}
                  testID={`orders-tab-${status}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${ORDER_STATUSES.labels[status]}, ${counts?.[status] ?? 0} orders`}
                  onPress={() => setPage(i)}
                  style={[styles.tab, { borderColor: selected ? colors.text : "transparent" }]}
                >
                  <Text variant="label" color={selected ? colors.text : colors.textMuted}>
                    {ORDER_STATUSES.labels[status]}
                    {counts ? ` · ${counts[status]}` : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {PAGES.map((status, i) => (
          // Both stay mounted so each keeps its month and scroll position.
          <View key={status} style={{ flex: 1, display: page === i ? "flex" : "none" }}>
            <OrdersPage status={status} search={search} unpaid={unpaid} onOpen={(id) => router.push(`/orders/${id}`)} />
          </View>
        ))}
      </View>
    </TabSwipe>
  );
}

/** One status: in-production orders all together; completed orders a month or a year at a time. */
function OrdersPage({ status, search, unpaid, onOpen }: { status: Status; search: string; unpaid: boolean; onOpen: (id: string) => void }) {
  const { colors } = useTheme();
  const { gutter } = useLayout();
  const [chosen, setChosen] = useState<Period | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const searching = search.trim() !== "";
  const browsing = status === "completed" && !searching;

  const { data: months } = useLiveQuery((s) => orderMonths(s, { status }), [status]);
  const { data: years } = useLiveQuery((s) => orderYears(s, { status }), [status]);
  // Until one is chosen, open on the newest month with orders.
  const period: Period = chosen ?? { by: "month", month: months?.[0]?.month ?? thisMonth() };
  const filter = !browsing ? {} : period.by === "month" ? { month: period.month } : { year: period.year };
  const { data, loading } = useLiveQuery(
    (s) => listOrders(s, { search, status, unpaid, ...filter, limit }),
    [search, status, unpaid, browsing, filter.month, filter.year, limit],
  );
  const summary = period.by === "month" ? months?.find((m) => m.month === period.month) : years?.find((y) => y.year === period.year);
  const latest: Period | null =
    period.by === "month" ? (months?.[0] ? { by: "month", month: months[0].month } : null) : years?.[0] ? { by: "year", year: years[0].year } : null;
  const show = (p: Period) => {
    setChosen(p);
    setLimit(PAGE_SIZE);
  };

  const header = browsing ? (
    <View style={{ gap: 12, paddingBottom: 4 }}>
      <PeriodNavigator period={period} months={months ?? []} years={years ?? []} onChange={show} />
      <View style={[styles.stats, { borderColor: colors.divider }]}>
        {[
          ["Orders", String(summary?.orders ?? 0)],
          ["Sales", formatMoney(summary?.selling ?? 0)],
          ["To collect", formatMoney(summary?.balance ?? 0)],
        ].map(([label, value], i) => (
          <View
            key={label}
            accessible
            accessibilityLabel={`${label}: ${value}`}
            style={{ flex: 1, gap: 4, paddingHorizontal: 10, borderLeftWidth: i ? StyleSheet.hairlineWidth : 0, borderColor: colors.divider }}
          >
            <Text variant="eyebrow" muted>
              {label}
            </Text>
            <Text variant="money" style={{ fontSize: 18 }} numberOfLines={1} adjustsFontSizeToFit>
              {value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  ) : undefined;

  return (
    <SectionList
      testID={`order-list-${status}`}
      sections={group(data ?? [], browsing && period.by === "month" ? "day" : "month")}
      keyExtractor={(o) => o.id}
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 12, paddingBottom: 32, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}
      renderSectionHeader={({ section }) => (
        <Text variant="eyebrow" color={colors.accent} accessibilityRole="header" style={{ backgroundColor: colors.background, paddingTop: 16, paddingBottom: 8 }}>
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => (
        <OrderRow order={item} onPress={() => onOpen(item.id)} />
      )}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if ((data?.length ?? 0) >= limit) setLimit((l) => l + PAGE_SIZE);
      }}
      ListEmptyComponent={
        loading ? undefined : (
          <EmptyState
            icon="receipt-outline"
            title={
              searching
                ? "No matching orders"
                : browsing && latest
                  ? `No completed orders in ${periodLabel(period)}`
                  : status === "in_production"
                    ? "Nothing in production"
                    : "No completed orders yet"
            }
            action={
              browsing && latest && periodLabel(latest) !== periodLabel(period) ? (
                <Button label={`Go to ${periodLabel(latest)}`} variant="secondary" onPress={() => show(latest)} />
              ) : undefined
            }
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: TOUCH_TARGET, alignItems: "center", justifyContent: "center", borderBottomWidth: 2 },
  stats: { flexDirection: "row", paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
});
