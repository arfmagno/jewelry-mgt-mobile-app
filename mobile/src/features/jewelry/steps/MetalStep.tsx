import { SwitchRow } from "@/components/fields";
import { Card } from "@/components/layout";
import { MetalFields } from "../MetalFields";
import { PartHeader, StepTitle, type StepProps } from "./common";

export function MetalStep({ form, set, errors }: StepProps) {
  const several = form.components.length > 1;
  const ownMetal = !form.sameMetalForAll;

  return (
    <>
      <StepTitle title="Metal" subtitle="Choose the metal and enter its weight if you know it." />
      {several ? (
        <SwitchRow
          label="Different metal for each part"
          hint="For mixed-metal sets"
          value={!form.sameMetalForAll}
          onChange={(different) => set({ sameMetalForAll: !different })}
        />
      ) : null}
      {ownMetal ? (
        form.components.map((c, i) => (
          <Card key={c.key} style={{ gap: 16 }}>
            <PartHeader type={c.type} />
            <MetalFields
              value={c}
              errors={errors}
              errorPrefix={`components.${i}.`}
              onChange={(patch) => set({ components: form.components.map((x) => (x.key === c.key ? { ...x, ...patch } : x)) })}
            />
          </Card>
        ))
      ) : (
        <MetalFields value={form} onChange={set} errors={errors} weightLabel={several ? "Total metal weight" : "Metal weight"} />
      )}
    </>
  );
}
