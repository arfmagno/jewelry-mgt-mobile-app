import { fieldSchemas, formatPhPhone } from "@jewelry/shared";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Button } from "@/components/Button";
import { Columns, Loading, Screen } from "@/components/layout";
import { TextField } from "@/components/fields";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { fieldErrors, orNull, reportError, type FieldErrors } from "@/lib/forms";
import { selection } from "@/lib/selection";
import { useStore } from "@/providers/app";

type Form = { firstName: string; lastName: string; phone: string; address: string; notes: string };

export default function ClientEditScreen() {
  const { id, channel } = useLocalSearchParams<{ id?: string; channel?: string }>();
  const { data, loading } = useLiveQuery((s) => (id ? s.get("clients", id) : Promise.resolve(null)), [id]);
  const [initial, setInitial] = useState<Form | null>(null);
  if (!initial && !loading) {
    setInitial({
      firstName: data?.firstName ?? "",
      lastName: data?.lastName ?? "",
      phone: data ? formatPhPhone(data.phone) : "",
      address: data?.address ?? "",
      notes: data?.notes ?? "",
    });
  }
  if (!initial) return <Loading />;
  return <ClientForm id={id} initial={initial} channel={channel} />;
}

function ClientForm({ id, initial, channel }: { id?: string; initial: Form; channel?: string }) {
  const store = useStore();
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    const input = {
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      address: orNull(form.address),
      notes: orNull(form.notes),
    };
    const check = fieldSchemas.clients.safeParse(input);
    if (!check.success) {
      setErrors(fieldErrors(check.error) ?? {});
      return;
    }
    setSaving(true);
    try {
      const saved = await store.upsert("clients", id, input);
      if (channel) selection.deliver(channel, saved.id);
      router.back();
    } catch (e) {
      reportError(e);
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: id ? "Edit client" : "New client" }} />
      <Screen
        footer={
          <>
            <Button label="Cancel" variant="ghost" onPress={() => router.back()} style={{ flex: 1 }} />
            <Button testID="save-client" label="Save client" icon="checkmark" onPress={save} busy={saving} style={{ flex: 2 }} />
          </>
        }
      >
        <Columns>
          <TextField testID="client-first-name" label="First name" required value={form.firstName} onChangeText={(firstName) => set({ firstName })} error={errors.firstName} autoComplete="name-given" maxLength={60} />
          <TextField testID="client-last-name" label="Last name" required value={form.lastName} onChangeText={(lastName) => set({ lastName })} error={errors.lastName} autoComplete="name-family" maxLength={60} />
        </Columns>
        <TextField
          testID="client-phone"
          label="Contact number"
          required
          hint="Mobile (0917 123 4567) or landline (02 8123 4567)"
          value={form.phone}
          onChangeText={(phone) => set({ phone })}
          error={errors.phone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
        />
        <TextField label="Address" value={form.address} onChangeText={(address) => set({ address })} multiline maxLength={300} autoComplete="street-address" />
        <TextField label="Notes" hint="Preferences, ring sizes, occasions…" value={form.notes} onChangeText={(notes) => set({ notes })} multiline maxLength={2000} />
      </Screen>
    </>
  );
}
