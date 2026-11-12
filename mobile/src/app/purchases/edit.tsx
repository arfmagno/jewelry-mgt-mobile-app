import { getPurchase, listMaterials, savePurchase, softDelete } from "@jewelry/core";
import { formatMoney, lineTotal, moneyToInput, parseMoney, UNITS } from "@jewelry/shared";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { Button, IconButton } from "@/components/Button";
import { DateField, MoneyField, NumberField, SelectField, TextField, todayIso } from "@/components/fields";
import { Card, Columns, Detail, Loading, Screen, Section } from "@/components/layout";
import { Text } from "@/components/Text";
import { newKey } from "@/features/jewelry/form";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useSupplierOptions } from "@/hooks/useOptions";
import { numberToInput, orNull, parseNumber, reportError } from "@/lib/forms";
import { selection } from "@/lib/selection";
import { useStore } from "@/providers/app";
import { useTheme } from "@/theme";

type Line = { key: string; id?: string; materialId: string | null; quantity: string; unitPrice: string };
type Form = { id?: string; supplierId: string | null; purchaseDate: string; notes: string; lines: Line[] };

const SUPPLIER_CHANNEL = "purchase-form.supplier";
const MATERIAL_CHANNEL = "purchase-form.material";

const emptyLine = (): Line => ({ key: newKey(), materialId: null, quantity: "", unitPrice: "" });

export default function PurchaseEditScreen() {
  const { id, supplierId } = useLocalSearchParams<{ id?: string; supplierId?: string }>();
  const { data, loading } = useLiveQuery((s) => (id ? getPurchase(s, id) : Promise.resolve(null)), [id]);
  const [initial, setInitial] = useState<Form | null>(null);
  if (!initial && !loading) {
    setInitial(
      data
        ? {
            id: data.purchase.id,
            supplierId: data.purchase.supplierId,
            purchaseDate: data.purchase.purchaseDate,
            notes: data.purchase.notes ?? "",
            lines: data.lines.map((l) => ({ key: l.id, id: l.id, materialId: l.materialId, quantity: numberToInput(l.quantity, 3), unitPrice: moneyToInput(l.unitPrice) })),
          }
        : { supplierId: supplierId ?? null, purchaseDate: todayIso(), notes: "", lines: [emptyLine()] },
    );
  }
  if (!initial) return <Loading />;
  return <PurchaseForm initial={initial} />;
}

function PurchaseForm({ initial }: { initial: Form }) {
  const store = useStore();
  const router = useRouter();
  const { colors } = useTheme();
  const suppliers = useSupplierOptions();
  const { data: materials } = useLiveQuery((s) => listMaterials(s), []);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pendingLine = useRef<string | null>(null);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    const offSupplier = selection.listen(SUPPLIER_CHANNEL, (supplierId) => setForm((f) => ({ ...f, supplierId })));
    const offMaterial = selection.listen(MATERIAL_CHANNEL, (materialId) =>
      setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.key === pendingLine.current ? { ...l, materialId } : l)) })),
    );
    return () => {
      offSupplier();
      offMaterial();
    };
  }, []);

  const setLine = (key: string, patch: Partial<Line>) => set({ lines: form.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) });

  const total = form.lines.reduce((s, l) => {
    const q = parseNumber(l.quantity);
    const p = parseMoney(l.unitPrice);
    return q && p !== null ? s + lineTotal(q, p) : s;
  }, 0);

  const save = async () => {
    const e: Record<string, string> = {};
    if (!form.supplierId) e.supplierId = "Choose a supplier";
    if (form.lines.length === 0) e.lines = "Add at least one item";
    form.lines.forEach((l) => {
      if (!l.materialId) e[`${l.key}.material`] = "Choose a material";
      const q = parseNumber(l.quantity);
      if (!q || q <= 0) e[`${l.key}.quantity`] = "Enter a quantity";
      if (parseMoney(l.unitPrice) === null) e[`${l.key}.price`] = "Enter a price";
    });
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      await savePurchase(store, {
        id: form.id,
        supplierId: form.supplierId!,
        purchaseDate: form.purchaseDate,
        notes: orNull(form.notes),
        lines: form.lines.map((l) => ({ id: l.id, materialId: l.materialId!, quantity: parseNumber(l.quantity)!, unitPrice: parseMoney(l.unitPrice)! })),
      });
      router.back();
    } catch (err) {
      reportError(err);
    }
  };

  const remove = () =>
    Alert.alert("Delete this purchase?", "You can restore it from Trash for 7 days.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await softDelete(store, "purchases", form.id!); router.back(); } },
    ]);

  const materialOptions = (materials ?? []).map((m) => ({ value: m.id, label: `${m.name} (per ${UNITS.labels[m.unit]})` }));

  return (
    <>
      <Stack.Screen options={{ title: form.id ? "Edit purchase" : "New purchase" }} />
      <Screen
        footer={
          <>
            <Button label="Cancel" variant="ghost" onPress={() => router.back()} style={{ flex: 1 }} />
            <Button label="Save purchase" icon="checkmark" onPress={save} style={{ flex: 2 }} />
          </>
        }
      >
        <Columns>
          <SelectField
            label="Supplier"
            required
            options={suppliers}
            value={form.supplierId}
            onChange={(supplierId) => set({ supplierId })}
            error={errors.supplierId}
            createLabel="New supplier"
            onCreate={() => router.push({ pathname: "/suppliers/edit", params: { channel: SUPPLIER_CHANNEL } })}
          />
          <DateField label="Purchase date" required value={form.purchaseDate} onChange={(d) => d && set({ purchaseDate: d })} />
        </Columns>
        <Section title="Items">
          {errors.lines ? <Text color={colors.danger}>{errors.lines}</Text> : null}
          {form.lines.map((l, i) => {
            const unit = materials?.find((m) => m.id === l.materialId)?.unit;
            return (
              <Card key={l.key}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text variant="label" style={{ flex: 1 }}>
                    Item {i + 1}
                  </Text>
                  <IconButton icon="trash-outline" label={`Remove item ${i + 1}`} onPress={() => set({ lines: form.lines.filter((x) => x.key !== l.key) })} />
                </View>
                <SelectField
                  label="Material"
                  options={materialOptions}
                  value={l.materialId}
                  onChange={(materialId) => setLine(l.key, { materialId })}
                  error={errors[`${l.key}.material`]}
                  createLabel="New material"
                  onCreate={() => {
                    pendingLine.current = l.key;
                    router.push({ pathname: "/materials/edit", params: { channel: MATERIAL_CHANNEL } });
                  }}
                />
                <Columns>
                  <NumberField label="Quantity" suffix={unit} value={l.quantity} onChangeText={(quantity) => setLine(l.key, { quantity })} error={errors[`${l.key}.quantity`]} />
                  <MoneyField label={unit ? `Price per ${unit}` : "Unit price"} value={l.unitPrice} onChangeText={(unitPrice) => setLine(l.key, { unitPrice })} error={errors[`${l.key}.price`]} />
                </Columns>
              </Card>
            );
          })}
          <Button label="Add item" icon="add" variant="secondary" onPress={() => set({ lines: [...form.lines, emptyLine()] })} />
        </Section>
        <Card>
          <Detail label="Total" value={<Text variant="money">{formatMoney(total)}</Text>} />
        </Card>
        <TextField label="Notes" hint="Receipt number, terms…" value={form.notes} onChangeText={(notes) => set({ notes })} multiline maxLength={2000} />
        {form.id ? <Button label="Delete purchase" variant="secondary" icon="trash-outline" onPress={remove} /> : null}
      </Screen>
    </>
  );
}
