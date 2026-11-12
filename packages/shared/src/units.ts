/**
 * Measurements are stored in fixed metric units (millimetres) and converted
 * only for display, so changing the display setting never alters data.
 */

export type LengthUnit = "in" | "cm";
export type RingSizeSystem = "us" | "iso";

const MM_PER_INCH = 25.4;

const round = (value: number, step: number) => Math.round(value / step) * step;

export function mmToLength(mm: number, unit: LengthUnit): number {
  return unit === "in" ? round(mm / MM_PER_INCH, 0.25) : round(mm / 10, 0.5);
}

export function lengthToMm(value: number, unit: LengthUnit): number {
  return unit === "in" ? value * MM_PER_INCH : value * 10;
}

export function formatLength(mm: number, unit: LengthUnit): string {
  const v = mmToLength(mm, unit);
  return unit === "in" ? `${trim(v)}″` : `${trim(v)} cm`;
}

/**
 * Ring sizes are stored as inner diameter in mm.
 *  US:  diameter = 11.63 + 0.8128 × size   (standard US/Canada scale)
 *  ISO: size = inner circumference in mm (ISO 8653)
 */
export function ringSizeFromMm(diameterMm: number, system: RingSizeSystem): number {
  if (system === "us") return round((diameterMm - 11.63) / 0.8128, 0.25);
  return round(Math.PI * diameterMm, 0.5);
}

export function ringSizeToMm(size: number, system: RingSizeSystem): number {
  if (system === "us") return 11.63 + 0.8128 * size;
  return size / Math.PI;
}

export function formatRingSize(diameterMm: number, system: RingSizeSystem): string {
  const size = ringSizeFromMm(diameterMm, system);
  return system === "us" ? `US ${trim(size)}` : `${trim(size)} mm`;
}

function trim(n: number): string {
  return Number(n.toFixed(2)).toString();
}
