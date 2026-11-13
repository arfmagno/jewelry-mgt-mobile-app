import { getJewelry, getSettings, saveJewelry } from "@jewelry/core";
import type { Jewelry, Settings } from "@jewelry/shared";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { Button } from "@/components/Button";
import { Loading, Screen } from "@/components/layout";
import { StepIndicator } from "@/components/tiles";
import {
  emptyPiece,
  errorsForStep,
  fromDetail,
  stepOfError,
  STEPS,
  suggestDescription,
  toDraft,
  validate,
  type FormErrors,
  type PieceForm,
} from "@/features/jewelry/form";
import { discardFiles } from "@/features/jewelry/PhotosEditor";
import type { StepProps } from "@/features/jewelry/steps/common";
import { CostsStep } from "@/features/jewelry/steps/CostsStep";
import { DetailsStep } from "@/features/jewelry/steps/DetailsStep";
import { FinishStep } from "@/features/jewelry/steps/FinishStep";
import { MetalStep } from "@/features/jewelry/steps/MetalStep";
import { StonesStep } from "@/features/jewelry/steps/StonesStep";
import { TypeStep } from "@/features/jewelry/steps/TypeStep";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { reportError } from "@/lib/forms";
import { selection } from "@/lib/selection";
import { useStore } from "@/providers/app";

type Params = { id?: string; origin?: Jewelry["origin"]; channel?: string };

const LAST = STEPS.length - 1;

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
  const editing = Boolean(initial.id);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<FormErrors>({});
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(editing ? LAST : 0);
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

  const open = (next: number) => {
    if (next === LAST && !form.description.trim()) set({ description: suggestDescription(form) });
    setStep(next);
    setReached((r) => Math.max(r, next));
    AccessibilityInfo.announceForAccessibility(`Step ${next + 1} of ${STEPS.length}, ${STEPS[next]!.label}`);
  };

  const announceProblems = (count: number) =>
    AccessibilityInfo.announceForAccessibility(`${count} ${count === 1 ? "field needs" : "fields need"} attention`);

  const next = () => {
    const stepErrors = errorsForStep(validate(form), step);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length) return announceProblems(Object.keys(stepErrors).length);
    open(step + 1);
  };

  const save = async () => {
    const all = validate(form);
    setErrors(all);
    const paths = Object.keys(all);
    if (paths.length) {
      const first = Math.min(...paths.map(stepOfError));
      if (first !== step) open(first);
      announceProblems(paths.length);
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

  const props: StepProps = { form, set, errors, settings, goTo: open };
  const key = STEPS[step]!.key;

  return (
    <>
      <Stack.Screen
        options={{
          title: editing ? "Edit piece" : "New piece",
          headerRight:
            editing && step !== LAST
              ? () => <Button testID="save-piece-header" label="Save" variant="ghost" onPress={save} busy={saving} />
              : undefined,
        }}
      />
      <Screen
        key={key}
        testID="jewelry-form"
        footer={
          <>
            {step > 0 ? (
              <Button label="Back" icon="arrow-back" variant="ghost" onPress={() => open(step - 1)} style={{ flex: 1 }} />
            ) : (
              <Button label="Cancel" variant="ghost" onPress={() => router.back()} style={{ flex: 1 }} />
            )}
            {step < LAST ? (
              <Button testID="next-step" label="Continue" icon="arrow-forward" onPress={next} style={{ flex: 2 }} />
            ) : (
              <Button testID="save-piece" label="Save piece" icon="checkmark" onPress={save} busy={saving} style={{ flex: 2 }} />
            )}
          </>
        }
      >
        <StepIndicator steps={[...STEPS]} current={step} canOpen={(i) => i <= reached} onOpen={open} />
        {key === "type" ? <TypeStep {...props} /> : null}
        {key === "metal" ? <MetalStep {...props} /> : null}
        {key === "details" ? <DetailsStep {...props} /> : null}
        {key === "stones" ? <StonesStep {...props} /> : null}
        {key === "costs" ? <CostsStep {...props} /> : null}
        {key === "finish" ? <FinishStep {...props} onFileCreated={(uri) => created.current.push(uri)} /> : null}
      </Screen>
    </>
  );
}
