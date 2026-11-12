/**
 * Philippine phone numbers.
 *
 *  Mobile:            0917 123 4567  | +63 917 123 4567   → +639171234567
 *  Metro Manila:      (02) 8123 4567 | +63 2 8123 4567    → +63281234567
 *  Provincial:        (032) 123 4567 | +63 32 123 4567    → +63321234567
 *
 * Stored in E.164 form so the same number always compares equal.
 */

export type PhoneKind = "mobile" | "landline";
export type ParsedPhone = { e164: string; kind: PhoneKind };

export function parsePhPhone(input: string): ParsedPhone | null {
  const trimmed = input.trim();
  if (!/^[+\d\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");

  let national: string;
  if (trimmed.startsWith("+")) {
    if (!digits.startsWith("63")) return null;
    national = digits.slice(2);
  } else if (digits.startsWith("63") && digits.length >= 11) {
    national = digits.slice(2);
  } else if (digits.startsWith("0")) {
    national = digits.slice(1);
  } else {
    return null;
  }

  // Mobile: 9XX XXX XXXX (10 digits)
  if (/^9\d{9}$/.test(national)) return { e164: `+63${national}`, kind: "mobile" };
  // Metro Manila: 2 + 8 digits
  if (/^2\d{8}$/.test(national)) return { e164: `+63${national}`, kind: "landline" };
  // Provincial: 2-digit area code (3–8) + 7 digits
  if (/^[3-8]\d{8}$/.test(national)) return { e164: `+63${national}`, kind: "landline" };
  return null;
}

export const isValidPhPhone = (input: string) => parsePhPhone(input) !== null;

/** Human-friendly local format, e.g. "0917 123 4567", "(02) 8123 4567", "(032) 123 4567". */
export function formatPhPhone(e164: string): string {
  const parsed = parsePhPhone(e164);
  if (!parsed) return e164;
  const n = parsed.e164.slice(3);
  if (parsed.kind === "mobile") return `0${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  if (n.startsWith("2")) return `(02) ${n.slice(1, 5)} ${n.slice(5)}`;
  return `(0${n.slice(0, 2)}) ${n.slice(2, 5)} ${n.slice(5)}`;
}
