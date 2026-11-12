import { listOrders } from "@jewelry/core";
import { formatMoney, ORDER_STATUSES, type JobOrder } from "@jewelry/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Fab } from "@/components/Button";
import { ChoiceChips, formatDate, optionsOf, TextField } from "@/components/fields";
import { Badge, EmptyState, ListRow, Screen } from "@/components/layout";
import { useLiveQuery } from "@/hooks/useLiveQuery";

export default function OrdersScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<JobOrder["status"] | null>(null);
  const { data, loading } = useLiveQuery((s) => listOrders(s, { search, status: status ?? undefined, limit: 300 }), [search, status]);

  return (
    <View style={{ flex: 1 }}>
      <Screen testID="order-list">
        <TextField label="Search orders" value={search} onChangeText={setSearch} placeholder="Code or client name" autoCorrect={false} />
        <ChoiceChips label="Status" allowClear options={optionsOf(ORDER_STATUSES)} value={status} onChange={setStatus} />
        {!loading && data?.length === 0 ? (
          <EmptyState icon="receipt-outline" title={search || status ? "No matching orders" : "No job orders yet"} />
        ) : (
          (data ?? []).map((o) => (
            <ListRow
              key={o.id}
              testID={`order-${o.id}`}
              title={`${o.code ?? "New order"} · ${o.clientName}`}
              subtitle={`${formatDate(o.orderDate)} · ${o.itemCount} piece(s) · ${formatMoney(o.selling)}${o.balance > 0 ? ` · balance ${formatMoney(o.balance)}` : " · paid"}`}
              trailing={
                <Badge
                  label={ORDER_STATUSES.labels[o.status]}
                  tone={o.status === "completed" ? "success" : "accent"}
                  icon={o.status === "completed" ? "checkmark-circle-outline" : "hammer-outline"}
                />
              }
              onPress={() => router.push(`/orders/${o.id}`)}
            />
          ))
        )}
      </Screen>
      <Fab testID="add-order" label="New order" onPress={() => router.push("/orders/edit")} />
    </View>
  );
}
