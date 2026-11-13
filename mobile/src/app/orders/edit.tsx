import { getOrder, getSettings, listJewelry, saveJobOrder, type JewelrySummary } from "@jewelry/core";
import { formatMoney, moneyToInput, ORDER_STATUSES, parseMoney, suggestedPrice, type JobOrder, type Settings } from "@jewelry/shared";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, IconButton } from "@/components/Button";
import { ChoiceChips, DateField, MoneyField, optionsOf, SelectField, TextField, todayIso } from "@/components/fields";
import { pieceLabel } from "@/components/JewelryCard";
import { Card, Columns, Detail, Loading, Screen, Section, Thumb } from "@/components/layout";
import { Text } from "@/components/Text";
import { PiecePicker } from "@/features/orders/PiecePicker";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useClientOptions } from "@/hooks/useOptions";
import { orNull, reportError } from "@/lib/forms";
import { selection } from "@/lib/selection";
import { useStore } from "@/providers/app";
import { useTheme } from "@/theme";

type Item = { key: string; itemId?: string; piece: JewelrySummary; sellingPrice: string };
type Form = {
  id?: string;
  code: string | null;
  clientId: string | null;
  orderDate: string;
  status: JobOrder["status"];
  notes: string;
  items: Item[];
};

const CLIENT_CHANNEL = "order-form.client";
const PIECE_CHANNEL = "order-form.piece";

export default function OrderEditScreen() {
  const { id, clientId } = useLocalSearchParams<{ id?: string; clientId?: string }>();
  const { data, loading } = useLiveQuery(
    async (s) => ({ settings: await getSettings(s), detail: id ? await getOrder(s, id) : null }),
    [id],
  );
  const [initial, setInitial] = useState<Form | null>(null);
  if (!initial && !loading && data) {
    const d = data.detail;
    setInitial(
      d
        ? {
            id: d.order.id,
            code: d.order.code,
            clientId: d.order.clientId,
            orderDate: d.order.orderDate,
            status: d.order.status,
            notes: d.order.notes ?? "",
            items: d.items.map((i) => ({ key: i.itemId, itemId: i.itemId, piece: i.jewelry, sellingPrice: moneyToInput(i.sellingPrice) })),
          }
        : { code: null, clientId: clientId ?? null, orderDate: todayIso(), status: "in_production", notes: "", items: [] },
    );
  }
  if (!initial || !data) return <Loading />;
  return <OrderForm initial={initial} settings={data.settings} />;
}

function OrderForm({ initial, settings }: { initial: Form; settings: Settings }) {
  const store = useStore();
  const router = useRouter();
  const { colors } = useTheme();
  const clients = useClientOptions();
  const [form, setForm] = useState(initial);
  const [picking, setPicking] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const addPiece = (piece: JewelrySummary) =>
    setForm((f) =>
      f.items.some((i) => i.piece.id === piece.id)
        ? f
        : { ...f, items: [...f.items, { key: piece.id, piece, sellingPrice: moneyToInput(suggestedPrice(piece.totalCost, settings.defaultMarkupPct)) }] },
    );

  // Records created from this form (new client / new made-to-order piece) come back here.
  useEffect(() => {
    const offClient = selection.listen(CLIENT_CHANNEL, (clientId) => setForm((f) => ({ ...f, clientId })));
    const offPiece = selection.listen(PIECE_CHANNEL, async (pieceId) => {
      const all = await listJewelry(store, { limit: 50 });
      const piece = all.find((j) => j.id === pieceId);
      if (piece) addPiece(piece);
    });
    return () => {
      offClient();
      offPiece();
    };
    // addPiece only depends on settings, which are fixed for this form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  const totals = form.items.reduce(
    (t, i) => ({ cost: t.cost + i.piece.totalCost, selling: t.selling + (parseMoney(i.sellingPrice) ?? 0) }),
    { cost: 0, selling: 0 },
  );
  const removedMadeToOrder = initial.items.filter(
    (i) => i.piece.origin === "made_to_order" && !form.items.some((x) => x.piece.id === i.piece.id),
  );

  const save = async () => {
    const e: Record<string, string> = {};
    if (!form.clientId) e.clientId = "Choose a client";
    if (form.items.length === 0) e.items = "Add at least one piece";
    form.items.forEach((i) => {
      if (parseMoney(i.sellingPrice) === null) e[`price.${i.key}`] = "Enter a price";
    });
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const orderId = await saveJobOrder(store, {
        id: form.id,
        clientId: form.clientId!,
        orderDate: form.orderDate,
        status: form.status,
        notes: orNull(form.notes),
        items: form.items.map((i) => ({ id: i.itemId, jewelryId: i.piece.id, sellingPrice: parseMoney(i.sellingPrice)! })),
      });
      if (form.id) router.back();
      else router.replace(`/orders/${orderId}`);
    } catch (err) {
      reportError(err);
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: form.id ? `Edit ${form.code ?? "order"}` : "New job order" }} />
      <Screen
        testID="order-form"
        footer={
          <>
            <Button label="Cancel" variant="ghost" onPress={() => router.back()} style={{ flex: 1 }} />
            <Button testID="save-order" label="Save order" icon="checkmark" onPress={save} busy={saving} style={{ flex: 2 }} />
          </>
        }
      >
        <SelectField
          testID="order-client"
          label="Client"
          required
          options={clients}
          value={form.clientId}
          onChange={(clientId) => set({ clientId })}
          error={errors.clientId}
          createLabel="New client"
          onCreate={() => router.push({ pathname: "/clients/edit", params: { channel: CLIENT_CHANNEL } })}
        />
        <Columns>
          <DateField label="Order date" required value={form.orderDate} onChange={(d) => d && set({ orderDate: d })} />
          <ChoiceChips label="Status" options={optionsOf(ORDER_STATUSES)} value={form.status} onChange={(s) => s && set({ status: s })} />
        </Columns>

        <Section title="Pieces">
          {errors.items ? <Text color={colors.danger} accessibilityRole="alert">{errors.items}</Text> : null}
          {form.items.map((i) => (
            <Card key={i.key}>
              <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <Thumb image={i.piece.image} size={56} kind={i.piece.pieceType} />
                <View style={{ flex: 1 }}>
                  <Text variant="caption" color={colors.accent}>
                    {pieceLabel(i.piece)}
                  </Text>
                  <Text numberOfLines={2}>{i.piece.description}</Text>
                  <Text variant="caption" muted>
                    Cost {formatMoney(i.piece.totalCost)}
                  </Text>
                </View>
                <IconButton
                  icon="close-circle-outline"
                  label={`Remove ${pieceLabel(i.piece)} from order`}
                  onPress={() => set({ items: form.items.filter((x) => x.key !== i.key) })}
                />
              </View>
              <MoneyField
                testID="item-price"
                label="Selling price"
                value={i.sellingPrice}
                onChangeText={(sellingPrice) => set({ items: form.items.map((x) => (x.key === i.key ? { ...x, sellingPrice } : x)) })}
                error={errors[`price.${i.key}`]}
              />
            </Card>
          ))}
          {removedMadeToOrder.length ? (
            <Text color={colors.warning} accessibilityRole="alert">
              ⚠ {removedMadeToOrder.length} made-to-order piece(s) removed from this order will be deleted when you save. On-hand pieces return to stock.
            </Text>
          ) : null}
          <Columns>
            <Button testID="add-existing-piece" label="Add available piece" icon="add" variant="secondary" onPress={() => setPicking(true)} />
            <Button
              label="Create new piece"
              icon="diamond-outline"
              variant="secondary"
              hint="Creates a made-to-order piece and adds it here"
              onPress={() => router.push({ pathname: "/jewelry/edit", params: { origin: "made_to_order", channel: PIECE_CHANNEL } })}
            />
          </Columns>
        </Section>

        <Card>
          <Detail label="Total cost" value={<Text variant="money">{formatMoney(totals.cost)}</Text>} />
          <Detail label="Total selling" value={<Text variant="money">{formatMoney(totals.selling)}</Text>} />
          <Detail label="Profit" value={<Text variant="money" color={colors.accent}>{formatMoney(totals.selling - totals.cost)}</Text>} />
        </Card>

        <TextField label="Notes" value={form.notes} onChangeText={(notes) => set({ notes })} multiline maxLength={2000} />
      </Screen>
      {picking ? (
        <PiecePicker
          exclude={form.items.map((i) => i.piece.id)}
          onPick={(p) => {
            addPiece(p);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </>
  );
}
