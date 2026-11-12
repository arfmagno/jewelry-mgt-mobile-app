import { getSettings } from "@jewelry/core";
import { DEFAULT_SETTINGS } from "@jewelry/shared";
import { useLiveQuery } from "./useLiveQuery";

/** Current settings, with defaults until loaded. */
export function useSettings() {
  const { data } = useLiveQuery((s) => getSettings(s), []);
  return data ?? DEFAULT_SETTINGS;
}
