import { getJewelry, getSettings, saveJewelry } from "@jewelry/core";
import { ORIGINS, type Jewelry, type Settings } from "@jewelry/shared";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import { Button } from "@/components/Button";
import { ChoiceChips, DateField, optionsOf, SwitchRow, TextField } from "@/components/fields";
import { Loading, Screen, Section } from "@/components/layout";
import { Text } from "@/components/Text";
import { CostsEditor } from "@/features/jewelry/CostsEditor";
import { emptyComponent, emptyPiece, fromDetail, toDraft, validate, type FormErrors, type PieceForm } from "@/features/jewelry/form";
import { MetalFields } from "@/features/jewelry/MetalFields";
import { PartEditor } from "@/features/jewelry/PartsEditor";
import { discardFiles, PhotosEditor } from "@/features/jewelry/PhotosEditor";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useMaterials, useSupplierOptions } from "@/hooks/useOptions";
import { reportError } from "@/lib/forms";
import { selection } from "@/lib/selection";
import { useStore } from "@/providers/app";
import { useTheme } from "@/theme";

type Params = { id?: string; origin?: Jewelry["origin"]; channel?: string };

export default function JewelryEditScreen() {
  const { id, origin, channel } = useLocalSearchParams<Params>();
  const { data, loading } = useLiveQuery(
    async (s) => ({ settings: await getSettings(s), detail: id ? await getJewelry(s, id) : null }),
    [id],
  );
  // Snapshot once so background sync doesn't overwrite what the user is typing.
  const [initial, setInitial] = useState<PieceForm | null>(null);
  if (!initial && !loading && data) {
    setInitial(
      data.detail
        ? fromDetail(data.detail, data.settings)
        : emptyPiece(origin === "made_to_order" ? "made_to_order" : "on_hand"),
    );
  }
  if (!initial) return <Loading />;
  return <Editor initial={initial} settings={data!.settings} channel={channel} />;
}

function Editor({ initial, settings, channel }: { initial: PieceForm; settings: Settings; channel?: string }) {
  const store = useStore();
  const router = useRouter();
  const { colors } = useTheme();
  const suppliers = useSupplierOptions();
  const materials = useMaterials(settings.materialTracking);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const created = useRef<string[]>([]);
  const saved = useRef(false);

  // Photos added in this session are removed if the edit is abandoned.
  useEffect(
    () => () => {
      if (!saved.current) discardFiles(created.current);
    },
    [],
  );

  const set = (patch: Partial<PieceForm>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length) {
      AccessibilityInfo.announceForAccessibility(`${Object.keys(e).length} fields need attention`);
      return;
    }
    setSaving(true);
    try {
      const pieceId = await saveJewelry(store, toDraft(form, settings));
      saved.current = true;
      if (channel) selection.deliver(channel, pieceId);
      router.back();
    } catch (err) {
      reportError(err);
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: form.id ? "Edit piece" : "New piece" }} />
      <Screen
        testID="jewelry-form"
        footer={
          <>
            <Button label="Cancel" variant="ghost" onPress={() => router.back()} style={{ flex: 1 }} />
            <Button testID="save-piece" label="Save piece" icon="checkmark" onPress={save} busy={saving} style={{ flex: 2 }} />
          </>
        }
      >
        <Section title="Piece">
          <TextField
            testID="piece-description"
            label="Description"
            required
            value={form.description}
            onChangeText={(description) => set({ description })}
            multiline
            maxLength={1000}
            error={errors.description}
          />
          <ChoiceChips
            label="Stock type"
            hint="On-hand pieces are made for stock; made-to-order pieces are made for a specific order."
            options={optionsOf(ORIGINS)}
            value={form.origin}
            onChange={(o) => o && set({ origin: o })}
          />
          <DateField label="Manufacture date" value={form.manufactureDate} onChange={(manufactureDate) => set({ manufactureDate })} allowClear />
        </Section>

        <Section title="Photos & designs">
          <PhotosEditor
            images={form.images}
            description={form.description}
            onChange={(images) => set({ images })}
            onFileCreated={(uri) => created.current.push(uri)}
          />
        </Section>

        <Section title="Metal">
          <SwitchRow
            label="Same metal for all parts"
            hint="Turn off for two-tone or mixed-metal sets"
            value={form.sameMetalForAll}
            onChange={(sameMetalForAll) => set({ sameMetalForAll })}
          />
          {form.sameMetalForAll ? <MetalFields value={form} onChange={set} errors={errors} weightLabel="Total metal weight" /> : (
            <Text muted>Set the metal on each part below.</Text>
          )}
        </Section>

        <Section title="Parts">
          {errors.components ? <Text color={colors.danger}>{errors.components}</Text> : null}
          {form.components.map((c, i) => (
            <PartEditor
              key={c.key}
              index={i}
              part={c}
              ownMetal={!form.sameMetalForAll}
              units={settings}
              suppliers={suppliers}
              errors={errors}
              onChange={(patch) => set({ components: form.components.map((x) => (x.key === c.key ? { ...x, ...patch } : x)) })}
              onRemove={form.components.length > 1 ? () => set({ components: form.components.filter((x) => x.key !== c.key) }) : null}
            />
          ))}
          <Button
            label="Add part"
            hint="For sets, add each item: ring, earrings, pendant, chain…"
            icon="add"
            variant="secondary"
            onPress={() => set({ components: [...form.components, emptyComponent("earrings")] })}
          />
        </Section>

        <Section title="Costs">
          <CostsEditor costs={form.costs} suppliers={suppliers} materials={materials} errors={errors} onChange={(costs) => set({ costs })} />
        </Section>

        <View>
          <TextField label="Notes" value={form.notes} onChangeText={(notes) => set({ notes })} multiline maxLength={2000} />
        </View>
      </Screen>
    </>
  );
}
