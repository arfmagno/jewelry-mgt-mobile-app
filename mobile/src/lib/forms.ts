import { DomainError } from "@jewelry/core";
import { Alert } from "react-native";

export type FieldErrors = Record<string, string>;

type ZodLike = { issues: { path: PropertyKey[]; message: string }[] };
const isZodLike = (e: unknown): e is ZodLike =>
  typeof e === "object" && e !== null && Array.isArray((e as ZodLike).issues);

/** Maps a validation error to `{ "field": "message" }` (nested paths joined with dots). */
export function fieldErrors(e: unknown): FieldErrors | null {
  if (!isZodLike(e)) return null;
  const out: FieldErrors = {};
  for (const issue of e.issues) {
    const key = issue.path.map(String).join(".");
    out[key] ??= issue.message;
  }
  return out;
}

/** Shows a friendly alert for errors that are not per-field. */
export function reportError(e: unknown, fallback = "Something went wrong. Please try again.") {
  const message = e instanceof DomainError ? e.message : fieldErrors(e) ? "Please check the highlighted fields." : fallback;
  Alert.alert("Can't save", message);
}

/** Empty strings become null (optional text columns). */
export const orNull = (s: string) => (s.trim() === "" ? null : s.trim());

/** Parses a number field; empty → null, invalid → NaN (caught by validation). */
export function parseNumber(s: string): number | null {
  if (s.trim() === "") return null;
  return Number(s.replace(/,/g, ""));
}

export const numberToInput = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined ? "" : String(Number(n.toFixed(digits)));
