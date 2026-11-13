import { deleteJobOrder, getOrder, softDelete } from "@jewelry/core";
import { formatMoney, ORDER_STATUSES, PAYMENT_METHODS, type Payment } from "@jewelry/shared";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { Button, IconButton } from "@/components/Button";
import { ChoiceChips, formatDate, optionsOf } from "@/components/fields";
import { pieceLabel } from "@/components/JewelryCard";
import { Card, Columns, Detail, EmptyState, ListRow, Loading, Screen, Section, Thumb } from "@/components/layout";
import { Text } from "@/components/Text";
import { PaymentForm } from "@/features/orders/PaymentForm";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { fullName, percent } from "@/lib/format";
import { useStore } from "@/providers/app";
import { useTheme } from "@/theme";

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const store = useStore();
  const { colors } = useTheme();
  const { data: d, loading } = useLiveQuery((s) => getOrder(s, id), [id]);
  const [payment, setPayment] = useState<Payment | "new" | null>(null);

  if (loading) return <Loading />;
  if (!d || d.order.deletedAt) return <EmptyState icon="trash-outline" title="This order was deleted" body="Restore it from Trash in More." />;
  const { order, totals } = d;
  const title = order.code ?? "New order";
  const madeToOrder = d.items.filter((i) => i.jewelry.origin === "made_to_order").length;

  const remove = () => {
    const del = (deleteMadeToOrderPieces: boolean) => async () => {
      await deleteJobOrder(store, order.id, { deleteMadeToOrderPieces });
      router.back();
    };
    if (madeToOrder === 0) {
      Alert.alert("Delete this order?", "Its pieces become available again. You can restore it from Trash for 7 days.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: del(false) },
      ]);
      return;
    }
    Alert.alert(
      "Delete this order?",
      `It has ${madeToOrder} made-to-order piece(s). Delete them too? On-hand pieces always return to stock.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Keep pieces", onPress: del(false) },
        { text: "Delete pieces too", style: "destructive", onPress: del(true) },
      ],
    );
  };

  const removePayment = (p: Payment) =>
    Alert.alert("Delete this payment?", `${formatMoney(p.amount)} on ${formatDate(p.paidAt)}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => softDelete(store, "payments", p.id) },
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton icon="create-outline" label="Edit order" onPress={() => router.push({ pathname: "/orders/edit", params: { id: order.id } })} />
          ),
        }}
      />
      <Screen testID="order-detail">
        <View style={{ gap: 8 }}>
          <Text variant="eyebrow" color={colors.accent}>
            {title} · {formatDate(order.orderDate)}
          </Text>
          <Text variant="title" accessibilityRole="header">
            {fullName(d.client)}
          </Text>
        </View>
        <ChoiceChips
          label="Status"
          options={optionsOf(ORDER_STATUSES)}
          value={order.status}
          onChange={(status) => status && status !== order.status && store.update("jobOrders", order.id, { status })}
        />
        <Columns>
          <Card>
            <Detail label="Selling price" value={<Text variant="money">{formatMoney(totals.selling)}</Text>} />
            <Detail label="Cost" value={<Text variant="money">{formatMoney(totals.cost)}</Text>} />
            <Detail label="Profit" value={<Text variant="money" color={colors.accent}>{`${formatMoney(totals.profit)} (${percent(totals.margin)})`}</Text>} />
          </Card>
          <Card>
            <Detail label="Paid" value={<Text variant="money">{formatMoney(totals.paid)}</Text>} />
            <Detail
              label="Balance"
              value={
                <Text variant="money" color={totals.balance > 0 ? colors.warning : colors.success}>
                  {totals.balance > 0 ? formatMoney(totals.balance) : "Fully paid"}
                </Text>
              }
            />
          </Card>
        </Columns>
        {d.client ? <ListRow icon="person-outline" title={fullName(d.client)} subtitle="View client" onPress={() => router.push(`/clients/${d.client!.id}`)} /> : null}

        <Section title="Pieces">
          {d.items.map((i) => (
            <ListRow
              key={i.itemId}
              title={`${pieceLabel(i.jewelry)} · ${i.jewelry.description}`}
              subtitle={`Selling ${formatMoney(i.sellingPrice)} · cost ${formatMoney(i.cost)}`}
              trailing={<Thumb image={i.jewelry.image} size={48} kind={i.jewelry.pieceType} />}
              onPress={() => router.push(`/jewelry/${i.jewelry.id}`)}
            />
          ))}
        </Section>

        <Section
          title="Payments"
          action={<Button testID="add-payment" label="Record" icon="add" variant="secondary" onPress={() => setPayment("new")} />}
        >
          {d.payments.length === 0 ? (
            <Text muted>No payments yet.</Text>
          ) : (
            d.payments.map((p) => (
              <ListRow
                key={p.id}
                title={formatMoney(p.amount)}
                subtitle={[formatDate(p.paidAt), PAYMENT_METHODS.labels[p.method], p.notes].filter(Boolean).join(" · ")}
                onPress={() => setPayment(p)}
                trailing={<IconButton icon="trash-outline" label={`Delete payment of ${formatMoney(p.amount)}`} onPress={() => removePayment(p)} />}
              />
            ))
          )}
        </Section>

        {order.notes ? (
          <Card>
            <Detail label="Notes" value={order.notes} />
          </Card>
        ) : null}
        <Button label="Delete order" variant="secondary" icon="trash-outline" onPress={remove} />
      </Screen>
      {payment ? (
        <PaymentForm
          orderId={order.id}
          payment={payment === "new" ? null : payment}
          suggested={payment === "new" ? totals.balance : 0}
          onClose={() => setPayment(null)}
        />
      ) : null}
    </>
  );
}
