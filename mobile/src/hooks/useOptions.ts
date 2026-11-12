import { listClients, listMaterials, listSuppliers } from "@jewelry/core";
import type { Option } from "@/components/fields";
import { fullName } from "@/lib/format";
import { useLiveQuery } from "./useLiveQuery";

/** Supplier choices for pickers. */
export function useSupplierOptions(): Option<string>[] {
  const { data } = useLiveQuery((s) => listSuppliers(s, { limit: 1000 }), []);
  return (data ?? []).map((s) => ({ value: s.id, label: s.name }));
}

/** Client choices for pickers. */
export function useClientOptions(): Option<string>[] {
  const { data } = useLiveQuery((s) => listClients(s, { limit: 5000 }), []);
  return (data ?? []).map((c) => ({ value: c.id, label: fullName(c) }));
}

/** Materials, or null when material tracking is off. */
export function useMaterials(enabled: boolean) {
  const { data } = useLiveQuery((s) => (enabled ? listMaterials(s) : Promise.resolve(null)), [enabled]);
  return data ?? null;
}
