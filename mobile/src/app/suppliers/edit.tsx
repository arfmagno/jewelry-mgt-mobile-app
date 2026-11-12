import { listPurchases, softDelete } from "@jewelry/core";
import { fieldSchemas, formatMoney, formatPhPhone } from "@jewelry/shared";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { Button } from "@/components/Button";
import { formatDate, TextField } from "@/components/fields";
import { ListRow, Loading, Screen, Section } from "@/components/layout";
import { Text } from "@/components/Text";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { fieldErrors, orNull, reportError, type FieldErrors } from "@/lib/forms";
import { selection } from "@/lib/selection";
import { useStore } from "@/providers/app";

type Form = { name: string; phone: string; address: string; notes: string };

export default function SupplierEditScreen() {
  const { id, channel } = useLocalSearchParams<{ id?: string; channel?: string }>();
  const { data, loading } = useLiveQuery((s) => (id ? s.get("suppliers", id) : Promise.resolve(null)), [id]);
  const [initial, setInitial] = useState<Form | null>(null);
  if (!initial && !loading) {
    setInitial({ name: data?.name ?? "", phone: data ? formatPhPhone(data.phone) : "", address: data?.address ?? "", notes: data?.notes ?? "" });
  }
  if (!initial) return <Loading />;
  return <SupplierForm id={id} initial={initial} channel={channel} />;
}

function SupplierForm({ id, initial, channel }: { id?: string; initial: Form; channel?: string }) {
  const store = useStore();
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const { data: purchases } = useLiveQuery((s) => (id ? listPurchases(s, { supplierId: id, limit: 20 }) : Promise.resolve([])), [id]);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    const input = { name: form.name, phone: form.phone, address: orNull(form.address), notes: orNull(form.notes) };
    const check = fieldSchemas.suppliers.safeParse(input);
    if (!check.success) {
      setErrors(fieldErrors(check.error) ?? {});
      return;
    }
    setSaving(true);
    try {
      const saved = await store.upsert("suppliers", id, input);
      if (channel) selection.deliver(channel, saved.id);
      router.back();
    } catch (e) {
      reportError(e);
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert("Delete this supplier?", "Past purchases and costs keep the supplier's name. You can restore it from Trash for 7 days.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await softDelete(store, "suppliers", id!);
          router.back();
        },
      },
    ]);

  return (
    <>
      <Stack.Screen options={{ title: id ? "Edit supplier" : "New supplier" }} />
      <Screen
        footer={
          <>
            <Button label="Cancel" variant="ghost" onPress={() => router.back()} style={{ flex: 1 }} />
            <Button label="Save supplier" icon="checkmark" onPress={save} busy={saving} style={{ flex: 2 }} />
          </>
        }
      >
        <TextField label="Name" required value={form.name} onChangeText={(name) => set({ name })} error={errors.name} maxLength={120} />
        <TextField
          label="Contact number"
          required
          hint="Mobile or landline"
          value={form.phone}
          onChangeText={(phone) => set({ phone })}
          error={errors.phone}
          keyboardType="phone-pad"
        />
        <TextField label="Address" value={form.address} onChangeText={(address) => set({ address })} multiline maxLength={300} />
        <TextField label="Notes" value={form.notes} onChangeText={(notes) => set({ notes })} multiline maxLength={2000} />
        {id ? (
          <>
            <Section
              title="Recent purchases"
              action={<Button label="New" icon="add" variant="secondary" onPress={() => router.push({ pathname: "/purchases/edit", params: { supplierId: id } })} />}
            >
              {purchases?.length ? (
                purchases.map((p) => (
                  <ListRow
                    key={p.id}
                    title={formatDate(p.purchaseDate)}
                    subtitle={`${p.lineCount} item(s) · ${formatMoney(p.total)}`}
                    onPress={() => router.push({ pathname: "/purchases/edit", params: { id: p.id } })}
                  />
                ))
              ) : (
                <Text muted>No purchases recorded.</Text>
              )}
            </Section>
            <Button label="Delete supplier" variant="secondary" icon="trash-outline" onPress={remove} />
          </>
        ) : null}
      </Screen>
    </>
  );
}
