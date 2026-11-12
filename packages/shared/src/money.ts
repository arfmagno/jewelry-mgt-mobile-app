/**
 * Money is stored as integer minor units (centavos) to avoid float rounding.
 */

const SYMBOLS: Record<string, string> = { PHP: "₱", USD: "$" };

export function formatMoney(minor: number, currency = "PHP"): string {
  const negative = minor < 0;
  const abs = Math.abs(Math.round(minor));
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cents = (abs % 100).toString().padStart(2, "0");
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  return `${negative ? "-" : ""}${symbol}${whole}.${cents}`;
}

/** Parses user input like "12,500", "₱12,500.5" or "12500.50" into centavos. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[₱$,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole = "0", frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/** Editable text for a money input, e.g. 1250050 → "12500.50". */
export function moneyToInput(minor: number | null | undefined): string {
  if (minor == null) return "";
  return (minor / 100).toFixed(2);
}

/** Quantity × unit price, rounded to whole centavos. */
export const lineTotal = (quantity: number, unitPriceMinor: number) =>
  Math.round(quantity * unitPriceMinor);
