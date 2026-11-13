import { Storage } from "expo-sqlite/kv-store";

/**
 * Preferences that belong to this phone rather than to the records, so they
 * are kept on the device and never synced.
 */

export type AppearancePreference = "system" | "light" | "dark";
const APPEARANCE_KEY = "appearance";

export function loadAppearance(): AppearancePreference {
  try {
    const v = Storage.getItemSync(APPEARANCE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function saveAppearance(value: AppearancePreference) {
  try {
    Storage.setItemSync(APPEARANCE_KEY, value);
  } catch {
    // Not saved: the choice still applies until the app restarts.
  }
}
