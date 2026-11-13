import { hasMetalColor, METAL_COLORS, METALS, PURITIES } from "@jewelry/shared";
import { ChoiceChips, NumberField, TextField } from "@/components/fields";
import { MetalSwatch } from "@/components/illustrations";
import { TilePicker } from "@/components/tiles";
import { useTheme } from "@/theme";
import type { FormErrors, PieceForm } from "./form";

type MetalValue = Pick<PieceForm, "metal" | "purity" | "metalColor" | "weightG">;

/** Metal, purity (karat/fineness), gold colour and weight, chosen visually. */
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
  const { colors } = useTheme();
  const purities = value.metal ? PURITIES[value.metal] : [];
  const goldLook = value.metalColor ?? "yellow";

  return (
    <>
      <TilePicker
        label="Metal"
        testIDPrefix={`${errorPrefix}metal`}
        value={value.metal}
        minTileWidth={88}
        onChange={(metal) =>
          onChange({
            metal,
            purity: metal && PURITIES[metal].includes(value.purity) ? value.purity : metal === "gold" ? "18K" : metal === "silver" ? "925" : "",
            metalColor: hasMetalColor(metal) ? (value.metalColor ?? "yellow") : null,
          })
        }
        tiles={METALS.values.map((m) => ({
          value: m,
          label: METALS.labels[m],
          art: () => <MetalSwatch look={m === "gold" ? goldLook : m} size={44} ring={colors.border} />,
        }))}
      />
      {purities.length ? (
        <ChoiceChips
          label={value.metal === "gold" ? "Karat" : "Fineness"}
          hint={value.metal === "gold" ? "24K is pure gold; 18K is 75% gold." : "Parts per thousand; 925 is sterling silver."}
          options={purities.map((p) => ({ value: p, label: p }))}
          value={value.purity || null}
          allowClear
          onChange={(p) => onChange({ purity: p ?? "" })}
        />
      ) : value.metal ? (
        <TextField label="Purity or grade" placeholder="e.g. 316L" value={value.purity} onChangeText={(purity) => onChange({ purity })} maxLength={10} />
      ) : null}
      {hasMetalColor(value.metal) ? (
        <TilePicker
          label="Gold colour"
          value={value.metalColor}
          minTileWidth={72}
          onChange={(metalColor) => onChange({ metalColor })}
          tiles={METAL_COLORS.values.map((c) => ({
            value: c,
            label: METAL_COLORS.labels[c],
            art: () => <MetalSwatch look={c} size={36} ring={colors.border} />,
          }))}
        />
      ) : null}
      <NumberField
        testID={`${errorPrefix}weight`}
        label={weightLabel}
        suffix="g"
        value={value.weightG}
        onChangeText={(weightG) => onChange({ weightG })}
        error={errors[`${errorPrefix}weightG`]}
      />
    </>
  );
}
