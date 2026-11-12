import { METAL_COLORS, METALS, PURITIES } from "@jewelry/shared";
import { ChoiceChips, NumberField, optionsOf, TextField } from "@/components/fields";
import { Columns } from "@/components/layout";
import type { FormErrors, PieceForm } from "./form";

type MetalValue = Pick<PieceForm, "metal" | "purity" | "metalColor" | "weightG">;

/** Metal, purity (karat/fineness), colour and weight. */
export function MetalFields({
  value,
  onChange,
  errors,
  errorPrefix = "",
  weightLabel = "Metal weight",
}: {
  value: MetalValue;
  onChange: (patch: Partial<MetalValue>) => void;
  errors: FormErrors;
  errorPrefix?: string;
  weightLabel?: string;
}) {
  const purities = value.metal ? PURITIES[value.metal] : [];
  return (
    <>
      <ChoiceChips
        label="Metal"
        options={optionsOf(METALS)}
        value={value.metal}
        allowClear
        onChange={(metal) => onChange({ metal, purity: metal && PURITIES[metal].includes(value.purity) ? value.purity : "" })}
      />
      {purities.length ? (
        <ChoiceChips
          label={value.metal === "gold" ? "Karat" : "Fineness"}
          hint={value.metal === "gold" ? "24K is pure gold; 18K is 75% gold." : "Parts per thousand, e.g. 925 sterling silver."}
          options={purities.map((p) => ({ value: p, label: p }))}
          value={value.purity || null}
          allowClear
          onChange={(p) => onChange({ purity: p ?? "" })}
        />
      ) : value.metal ? (
        <TextField label="Purity" value={value.purity} onChangeText={(purity) => onChange({ purity })} maxLength={10} />
      ) : null}
      <Columns>
        <ChoiceChips
          label="Metal colour"
          options={optionsOf(METAL_COLORS)}
          value={value.metalColor}
          allowClear
          onChange={(metalColor) => onChange({ metalColor })}
        />
        <NumberField
          label={weightLabel}
          suffix="g"
          value={value.weightG}
          onChangeText={(weightG) => onChange({ weightG })}
          error={errors[`${errorPrefix}weightG`]}
        />
      </Columns>
    </>
  );
}
