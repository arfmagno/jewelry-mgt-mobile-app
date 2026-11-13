import { listOrders, orderCounts, orderMonths, type OrderSummary } from "@jewelry/core";
import { formatMoney, ORDER_STATUSES, type JobOrder } from "@jewelry/shared";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { FlatList, Pressable, SectionList, StyleSheet, useWindowDimensions, View } from "react-native";
import { Button } from "@/components/Button";
import { TextField } from "@/components/fields";
import { ListToolbar } from "@/components/ListToolbar";
import { EmptyState } from "@/components/layout";
import { Text } from "@/components/Text";
import { monthLabel, MonthNavigator, thisMonth } from "@/features/orders/MonthNavigator";
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
  const { colors, reduceMotion } = useTheme();
  const { gutter } = useLayout();
  const { width } = useWindowDimensions();
  const pager = useRef<FlatList<Status>>(null);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [unpaid, setUnpaid] = useState(false);
  const { data: counts } = useLiveQuery((s) => orderCounts(s), []);

  const showPage = (i: number) => {
    setPage(i);
    pager.current?.scrollToIndex({ index: i, animated: !reduceMotion });
  };

  return (
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
                onPress={() => showPage(i)}
                style={[styles.tab, { borderColor: selected ? colors.accent : "transparent" }]}
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

      <FlatList
        ref={pager}
        data={PAGES}
        keyExtractor={(s) => s}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width }}>
            <OrdersPage status={item} search={search} unpaid={unpaid} onOpen={(id) => router.push(`/orders/${id}`)} />
          </View>
        )}
      />
    </View>
  );
}

/** One status: in-production orders all together; completed orders a month at a time. */
function OrdersPage({ status, search, unpaid, onOpen }: { status: Status; search: string; unpaid: boolean; onOpen: (id: string) => void }) {
  const { colors, radius } = useTheme();
  const { gutter } = useLayout();
  const [chosenMonth, setChosenMonth] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const searching = search.trim() !== "";
  const byMonth = status === "completed" && !searching;

  const { data: months } = useLiveQuery((s) => orderMonths(s, { status }), [status]);
  // Until a month is chosen, open on the newest month with orders.
  const month = chosenMonth ?? months?.[0]?.month ?? thisMonth();
  const { data, loading } = useLiveQuery(
    (s) => listOrders(s, { search, status, unpaid, month: byMonth ? month : undefined, limit }),
    [search, status, unpaid, byMonth, month, limit],
  );
  const summary = months?.find((m) => m.month === month);
  const pickMonth = (m: string) => {
    setChosenMonth(m);
    setLimit(PAGE_SIZE);
  };

  const header = byMonth ? (
    <View style={{ gap: 12, paddingBottom: 4 }}>
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
    </View>
  ) : undefined;

  return (
    <SectionList
      testID={`order-list-${status}`}
      sections={group(data ?? [], byMonth ? "day" : "month")}
      keyExtractor={(o) => o.id}
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 12, paddingBottom: 32, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}
      renderSectionHeader={({ section }) => (
        <Text variant="label" muted accessibilityRole="header" style={{ backgroundColor: colors.background, paddingTop: 12, paddingBottom: 6 }}>
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => (
        <View style={{ paddingBottom: 8 }}>
          <OrderRow order={item} onPress={() => onOpen(item.id)} />
        </View>
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
                : byMonth && months?.length
                  ? `No completed orders in ${monthLabel(month)}`
                  : status === "in_production"
                    ? "Nothing in production"
                    : "No completed orders yet"
            }
            action={
              byMonth && months?.length && month !== months[0]!.month ? (
                <Button label={`Go to ${monthLabel(months[0]!.month)}`} variant="secondary" onPress={() => pickMonth(months[0]!.month)} />
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
  tab: { flex: 1, minHeight: TOUCH_TARGET, alignItems: "center", justifyContent: "center", borderBottomWidth: 3 },
});
