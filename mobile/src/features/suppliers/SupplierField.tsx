import { useRouter } from "expo-router";
import { useEffect, useId, useRef } from "react";
import { SelectField } from "@/components/fields";
import { useSupplierOptions } from "@/hooks/useOptions";
import { selection } from "@/lib/selection";

/**
 * Supplier picker that can also create a supplier: "New supplier" opens the
 * supplier form, and the saved supplier is selected here on return.
 */
export function SupplierField({
  value,
  onChange,
  label = "Supplier",
  hint,
  error,
  required,
}: {
  value: string | null;
  onChange: (supplierId: string | null) => void;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
}) {
  const router = useRouter();
  const options = useSupplierOptions();
  const channel = `supplier-field.${useId()}`;
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => selection.listen(channel, (id) => onChangeRef.current(id)), [channel]);

  return (
    <SelectField
      label={label}
      hint={hint}
      error={error}
      required={required}
      options={options}
      value={value}
      allowClear={!required}
      onChange={onChange}
      createLabel="New supplier"
      onCreate={() => router.push({ pathname: "/suppliers/edit", params: { channel } })}
    />
  );
}
