import { RING_SIZES, type RingSizeSystem } from "@jewelry/shared";
import { SelectField } from "@/components/fields";

const usLabel = (n: number) => (Number.isInteger(n) ? `${n}` : `${Math.floor(n)}½`);

/** Ring size as a pick list in the user's sizing system; the value is the size as text. */
export function RingSizeField({
  system,
  value,
  onChange,
  error,
}: {
  system: RingSizeSystem;
  value: string;
  onChange: (size: string) => void;
  error?: string;
}) {
  const options = RING_SIZES[system].map((n) => ({
    value: String(n),
    label: system === "us" ? `US ${usLabel(n)}` : `${n} mm`,
  }));
  return (
    <SelectField
      testID="ring-size"
      label="Ring size"
      hint={system === "us" ? "US sizes" : "ISO: inner circumference in mm"}
      options={options}
      value={value || null}
      allowClear
      onChange={(v) => onChange(v ?? "")}
      error={error}
    />
  );
}
