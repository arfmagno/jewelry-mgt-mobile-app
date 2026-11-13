import { BRACELET_STYLES, CHAIN_STYLES, EARRING_BACKS } from "@jewelry/shared";
import { useState } from "react";
import { Button } from "@/components/Button";
import { NumberField, optionsOf, SelectField, TextField } from "@/components/fields";
import { Card, Columns } from "@/components/layout";
import { FIELDS_BY_TYPE, type ComponentForm, type FormErrors } from "../form";
import { RingSizeField } from "../RingSizeField";
import { PartHeader, StepTitle, type StepProps } from "./common";

export function DetailsStep({ form, set, errors, settings }: StepProps) {
  return (
    <>
      <StepTitle title="Sizes" subtitle="Fill in what you know; everything here is optional." />
      {form.components.map((c, i) => (
        <PartDetails
          key={c.key}
          part={c}
          prefix={`components.${i}.`}
          errors={errors}
          units={settings}
          onChange={(patch) => set({ components: form.components.map((x) => (x.key === c.key ? { ...x, ...patch } : x)) })}
        />
      ))}
    </>
  );
}

function PartDetails({
  part,
  prefix,
  errors,
  units,
  onChange,
}: {
  part: ComponentForm;
  prefix: string;
  errors: FormErrors;
  units: StepProps["settings"];
  onChange: (patch: Partial<ComponentForm>) => void;
}) {
  const applies = FIELDS_BY_TYPE[part.type];
  const [noteOpen, setNoteOpen] = useState(part.notes.trim() !== "");

  return (
    <Card style={{ gap: 16 }}>
      <PartHeader type={part.type} />
      <Columns>
        {applies.ringSize ? (
          <RingSizeField system={units.ringSizeSystem} value={part.ringSize} onChange={(ringSize) => onChange({ ringSize })} error={errors[`${prefix}ringSize`]} />
        ) : null}
        {applies.length ? (
          <NumberField
            label={part.type === "pendant" || part.type === "earrings" ? "Drop length" : "Length"}
            suffix={units.lengthUnit === "in" ? "in" : "cm"}
            value={part.length}
            onChangeText={(length) => onChange({ length })}
            error={errors[`${prefix}length`]}
          />
        ) : null}
        {applies.width ? (
          <NumberField label="Width" suffix="mm" value={part.widthMm} onChangeText={(widthMm) => onChange({ widthMm })} error={errors[`${prefix}widthMm`]} />
        ) : null}
      </Columns>
      {applies.earringBack ? (
        <SelectField label="Earring back" options={optionsOf(EARRING_BACKS)} value={part.earringBack} allowClear onChange={(earringBack) => onChange({ earringBack })} />
      ) : null}
      {applies.style ? (
        <SelectField
          label={applies.style === "chain" ? "Chain style" : "Bracelet style"}
          options={optionsOf<string>(applies.style === "chain" ? CHAIN_STYLES : BRACELET_STYLES)}
          value={part.style}
          allowClear
          onChange={(style) => onChange({ style: style as ComponentForm["style"] })}
        />
      ) : null}
      {noteOpen ? (
        <TextField label="Note" value={part.notes} onChangeText={(notes) => onChange({ notes })} multiline maxLength={2000} />
      ) : (
        <Button label="Add a note" icon="create-outline" variant="ghost" onPress={() => setNoteOpen(true)} style={{ alignSelf: "flex-start" }} />
      )}
    </Card>
  );
}
