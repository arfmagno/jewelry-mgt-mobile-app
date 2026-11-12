import { listOrders, softDelete } from "@jewelry/core";
import { formatMoney, formatPhPhone, ORDER_STATUSES } from "@jewelry/shared";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Linking } from "react-native";
import { Button, IconButton } from "@/components/Button";
import { formatDate } from "@/components/fields";
import { Card, Columns, Detail, EmptyState, ListRow, Loading, Screen, Section } from "@/components/layout";
import { Text } from "@/components/Text";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { fullName } from "@/lib/format";
import { useStore } from "@/providers/app";

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const store = useStore();
  const { data, loading } = useLiveQuery(
    async (s) => ({ client: await s.get("clients", id), orders: await listOrders(s, { clientId: id, limit: 200 }) }),
    [id],
  );

  if (loading) return <Loading />;
  const client = data?.client;
  if (!client || client.deletedAt) {
    return <EmptyState icon="trash-outline" title="This client was deleted" body="Restore them from Trash in More." />;
  }
  const orders = data.orders;
  const balance = orders.reduce((s, o) => s + o.balance, 0);

  const remove = () =>
    Alert.alert("Delete this client?", "Their order history is kept. You can restore them from Trash for 7 days.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await softDelete(store, "clients", client.id);
          router.back();
        },
      },
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          title: fullName(client),
          headerRight: () => (
            <IconButton icon="create-outline" label="Edit client" onPress={() => router.push({ pathname: "/clients/edit", params: { id: client.id } })} />
          ),
        }}
      />
      <Screen>
        <Text variant="title">{fullName(client)}</Text>
        <Columns>
          <Card>
            <Detail label="Contact number" value={formatPhPhone(client.phone)} />
            <Detail label="Address" value={client.address} />
            <Detail label="Notes" value={client.notes} />
          </Card>
          <Card>
            <Detail label="Orders" value={String(orders.length)} />
            <Detail label="Balance due" value={<Text variant="money">{formatMoney(balance)}</Text>} />
          </Card>
        </Columns>
        <Columns>
          <Button label="Call" icon="call-outline" variant="secondary" onPress={() => Linking.openURL(`tel:${client.phone}`)} />
          <Button
            label="New order"
            icon="add"
            onPress={() => router.push({ pathname: "/orders/edit", params: { clientId: client.id } })}
          />
        </Columns>
        <Section title="Orders">
          {orders.length === 0 ? (
            <Text muted>No orders yet.</Text>
          ) : (
            orders.map((o) => (
              <ListRow
                key={o.id}
                icon="receipt-outline"
                title={`${o.code ?? "New order"} · ${formatDate(o.orderDate)}`}
                subtitle={`${ORDER_STATUSES.labels[o.status]} · ${formatMoney(o.selling)} · balance ${formatMoney(o.balance)}`}
                onPress={() => router.push(`/orders/${o.id}`)}
              />
            ))
          )}
        </Section>
        <Button label="Delete client" variant="secondary" icon="trash-outline" onPress={remove} />
      </Screen>
    </>
  );
}
