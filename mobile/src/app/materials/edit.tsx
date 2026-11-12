import { latestPrice, softDelete, stockOnHand } from "@jewelry/core";
import { fieldSchemas, formatMoney, MATERIAL_KINDS, METALS, PURITIES, STOCK_REASONS, UNITS, type Material } from "@jewelry/shared";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { Button } from "@/components/Button";
import { ChoiceChips, formatDate, optionsOf, TextField } from "@/components/fields";
import { Card, Detail, ListRow, Loading, Screen, Section } from "@/components/layout";
import { Text } from "@/components/Text";
import { StockAdjustmentForm } from "@/features/materials/StockAdjustment";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useSettings } from "@/hooks/useSettings";
import { trim } from "@/lib/format";
import { fieldErrors, orNull, reportError, type FieldErrors } from "@/lib/forms";
import { selection } from "@/lib/selection";
import { useStore } from "@/providers/app";

type Form = { name: string; kind: Material["kind"]; unit: Material["unit"]; metal: Material["metal"]; purity: string; notes: string };

export default function MaterialEditScreen() {
  const { id, channel } = useLocalSearchParams<{ id?: string; channel?: string }>();
  const { data, loading } = useLiveQuery((s) => (id ? s.get("materials", id) : Promise.resolve(null)), [id]);
  const [initial, setInitial] = useState<Form | null>(null);
  if (!initial && !loading) {
    setInitial({
      name: data?.name ?? "",
      kind: data?.kind ?? "metal",
      unit: data?.unit ?? "g",
      metal: data?.metal ?? null,
      purity: data?.purity ?? "",
      notes: data?.notes ?? "",
    });
  }
  if (!initial) return <Loading />;
  return <MaterialForm id={id} initial={initial} channel={channel} />;
}

function MaterialForm({ id, initial, channel }: { id?: string; initial: Form; channel?: string }) {
  const store = useStore();
  const router = useRouter();
  const settings = useSettings();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [adjusting, setAdjusting] = useState(false);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const { data: info } = useLiveQuery(
    async (s) =>
      id
        ? {
            price: await latestPrice(s, id),
            stock: settings.materialTracking ? await stockOnHand(s, id) : null,
            adjustments: await s.select("stockAdjustments", "materialId = ? AND deletedAt IS NULL AND purgedAt IS NULL ORDER BY date DESC LIMIT 20", [id]),
          }
        : null,
    [id, settings.materialTracking],
  );

  const save = async () => {
    const input = {
      name: form.name,
      kind: form.kind,
      unit: form.unit,
      metal: form.kind === "metal" ? form.metal : null,
      purity: form.kind === "metal" ? orNull(form.purity) : null,
      notes: orNull(form.notes),
    };
    const check = fieldSchemas.materials.safeParse(input);
    if (!check.success) {
      setErrors(fieldErrors(check.error) ?? {});
      return;
    }
    try {
      const saved = await store.upsert("materials", id, input);
      if (channel) selection.deliver(channel, saved.id);
      router.back();
    } catch (e) {
      reportError(e);
    }
  };

  const remove = () =>
    Alert.alert("Delete this material?", "Past purchases keep their records. You can restore it from Trash for 7 days.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await softDelete(store, "materials", id!); router.back(); } },
    ]);

  return (
    <>
      <Stack.Screen options={{ title: id ? "Edit material" : "New material" }} />
      <Screen
        footer={
          <>
            <Button label="Cancel" variant="ghost" onPress={() => router.back()} style={{ flex: 1 }} />
            <Button label="Save material" icon="checkmark" onPress={save} style={{ flex: 2 }} />
          </>
        }
      >
        <TextField label="Name" required placeholder="e.g. 18K yellow gold grain" value={form.name} onChangeText={(name) => set({ name })} error={errors.name} maxLength={120} />
        <ChoiceChips label="Kind" options={optionsOf(MATERIAL_KINDS)} value={form.kind} onChange={(kind) => kind && set({ kind, unit: kind === "metal" ? "g" : kind === "stone" ? "ct" : "pc" })} />
        <ChoiceChips label="Priced per" options={optionsOf(UNITS)} value={form.unit} onChange={(unit) => unit && set({ unit })} />
        {form.kind === "metal" ? (
          <>
            <ChoiceChips label="Metal" options={optionsOf(METALS)} value={form.metal} allowClear onChange={(metal) => set({ metal, purity: "" })} />
            {form.metal && PURITIES[form.metal].length ? (
              <ChoiceChips
                label="Purity"
                options={PURITIES[form.metal].map((p) => ({ value: p, label: p }))}
                value={form.purity || null}
                allowClear
                onChange={(p) => set({ purity: p ?? "" })}
              />
            ) : null}
          </>
        ) : null}
        <TextField label="Notes" value={form.notes} onChangeText={(notes) => set({ notes })} multiline maxLength={2000} />

        {id && info ? (
          <Section title="Pricing & stock">
            <Card>
              <Detail
                label="Latest price"
                value={info.price ? `${formatMoney(info.price.unitPrice)} per ${form.unit} (${formatDate(info.price.purchaseDate)})` : "No purchases yet"}
              />
              {info.stock !== null ? <Detail label="On hand" value={`${trim(info.stock, 3)} ${form.unit}`} /> : null}
            </Card>
            {info.stock !== null ? (
              adjusting ? (
                <StockAdjustmentForm materialId={id} unit={form.unit} onDone={() => setAdjusting(false)} />
              ) : (
                <Button label="Adjust stock" icon="swap-vertical-outline" variant="secondary" onPress={() => setAdjusting(true)} />
              )
            ) : null}
            {info.stock !== null && info.adjustments.length ? (
              info.adjustments.map((a) => (
                <ListRow
                  key={a.id}
                  title={`${a.quantity > 0 ? "+" : ""}${trim(a.quantity, 3)} ${form.unit} · ${STOCK_REASONS.labels[a.reason]}`}
                  subtitle={[formatDate(a.date), a.notes].filter(Boolean).join(" · ")}
                />
              ))
            ) : null}
            {info.stock === null ? <Text variant="caption" muted>Turn on material tracking in Settings to follow stock levels.</Text> : null}
          </Section>
        ) : null}
        {id ? <Button label="Delete material" variant="secondary" icon="trash-outline" onPress={remove} /> : null}
      </Screen>
    </>
  );
}
