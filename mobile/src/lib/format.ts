import {
  BRACELET_STYLES,
  CHAIN_STYLES,
  COMPONENT_TYPES,
  EARRING_BACKS,
  formatLength,
  formatRingSize,
  METAL_COLORS,
  METALS,
  STONE_KINDS,
  STONE_SETTINGS,
  STONE_SHAPES,
  type JewelryComponent,
  type JewelryStone,
  type Settings,
} from "@jewelry/shared";

type MetalLike = Pick<JewelryComponent, "metal" | "purity" | "metalColor" | "weightG">;

export const trim = (n: number, digits = 2) => String(Number(n.toFixed(digits)));

/** "18K Yellow Gold · 3.2 g" */
export function formatMetal(m: MetalLike): string | null {
  const name = [m.purity, m.metalColor ? METAL_COLORS.labels[m.metalColor] : null, m.metal ? METALS.labels[m.metal] : null]
    .filter(Boolean)
    .join(" ");
  const weight = m.weightG ? `${trim(m.weightG)} g` : null;
  return [name || null, weight].filter(Boolean).join(" · ") || null;
}

/** Type-specific measurements in the user's units. */
export function formatComponentSpecs(
  c: JewelryComponent,
  s: Pick<Settings, "lengthUnit" | "ringSizeSystem">,
): string | null {
  const styles = { ...CHAIN_STYLES.labels, ...BRACELET_STYLES.labels } as Record<string, string>;
  const parts = [
    c.ringSizeMm ? `Size ${formatRingSize(c.ringSizeMm, s.ringSizeSystem)}` : null,
    c.earringBack ? EARRING_BACKS.labels[c.earringBack] : null,
    c.style ? (styles[c.style] ?? c.style) : null,
    c.lengthMm ? formatLength(c.lengthMm, s.lengthUnit) : null,
    c.widthMm ? `${trim(c.widthMm)} mm wide` : null,
  ];
  return parts.filter(Boolean).join(" · ") || null;
}

export const componentLabel = (c: Pick<JewelryComponent, "type">) => COMPONENT_TYPES.labels[c.type];

/** "12 × Round Diamond, 1.5 mm, 0.24 ct total · Prong" */
export function formatStone(s: JewelryStone): string {
  const name = [s.shape ? STONE_SHAPES.labels[s.shape] : null, s.gemName || STONE_KINDS.labels[s.stoneKind]]
    .filter(Boolean)
    .join(" ");
  const grade = [s.colorGrade, s.clarityGrade].filter(Boolean).join("/");
  const details = [s.sizeMm ? `${trim(s.sizeMm)} mm` : null, s.totalCarat ? `${trim(s.totalCarat)} ct total` : null, grade || null]
    .filter(Boolean)
    .join(", ");
  const setting = s.setting ? STONE_SETTINGS.labels[s.setting] : null;
  return [`${s.quantity} × ${name}${details ? `, ${details}` : ""}`, setting].filter(Boolean).join(" · ");
}

export const fullName = (c: { firstName: string; lastName: string } | null | undefined) =>
  c ? `${c.firstName} ${c.lastName}` : "Deleted client";

export const percent = (ratio: number | null) => (ratio === null ? "—" : `${Math.round(ratio * 100)}%`);
