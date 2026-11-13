import type { ComponentDraft, JewelryDetail, JewelryDraft } from "@jewelry/core";
import {
  COMPONENT_TYPES,
  hasMetalColor,
  lineTotal,
  METAL_COLORS,
  PIECE_TYPES,
  pieceType,
  lengthToMm,
  mmToLength,
  moneyToInput,
  nearestRingSize,
  parseMoney,
  ringSizeToMm,
  type CostCategory,
  type Jewelry,
  type JewelryComponent,
  type JewelryStone,
  type Settings,
} from "@jewelry/shared";
import { numberToInput, orNull, parseNumber } from "@/lib/forms";

/**
 * Form state for a jewelry piece. Inputs are kept as strings in the user's
 * units (ring size system, inches/cm, pesos) and converted to the stored
 * representation (mm, centavos) only when saving.
 */

type Units = Pick<Settings, "lengthUnit" | "ringSizeSystem">;
type MetalForm = {
  metal: Jewelry["metal"];
  purity: string;
  metalColor: Jewelry["metalColor"];
  weightG: string;
};

export type StoneForm = {
  key: string;
  id?: string;
  stoneKind: JewelryStone["stoneKind"];
  gemName: string;
  shape: JewelryStone["shape"];
  quantity: string;
  sizeMm: string;
  totalCarat: string;
  colorGrade: string;
  setting: JewelryStone["setting"];
  supplierId: string | null;
  /** Price of one stone, in pesos. */
  unitCost: string;
  notes: string;
};

export type ComponentForm = MetalForm & {
  key: string;
  id?: string;
  type: JewelryComponent["type"];
  ringSize: string;
  earringBack: JewelryComponent["earringBack"];
  length: string;
  style: JewelryComponent["style"];
  widthMm: string;
  notes: string;
  stones: StoneForm[];
};

export type CostForm = {
  key: string;
  id?: string;
  category: CostCategory;
  description: string;
  supplierId: string | null;
  materialId: string | null;
  quantity: string;
  unitCost: string;
};

export type ImageForm = {
  key: string;
  id: string;
  localUri: string | null;
  storageKey: string | null;
  source: "upload" | "ai";
  aiPrompt: string | null;
  isPrimary: boolean;
};

export type PieceForm = MetalForm & {
  id?: string;
  description: string;
  origin: Jewelry["origin"];
  manufactureDate: string | null;
  sameMetalForAll: boolean;
  notes: string;
  components: ComponentForm[];
  costs: CostForm[];
  images: ImageForm[];
};

let seq = 0;
export const newKey = () => `k${Date.now().toString(36)}${(seq++).toString(36)}`;

export const emptyStone = (): StoneForm => ({
  key: newKey(),
  stoneKind: "natural_diamond",
  gemName: "",
  shape: "round",
  quantity: "1",
  sizeMm: "",
  totalCarat: "",
  colorGrade: "",
  setting: null,
  supplierId: null,
  unitCost: "",
  notes: "",
});

export const emptyComponent = (type: JewelryComponent["type"] = "ring"): ComponentForm => ({
  key: newKey(),
  type,
  metal: null,
  purity: "",
  metalColor: null,
  weightG: "",
  ringSize: "",
  earringBack: null,
  length: "",
  style: null,
  widthMm: "",
  notes: "",
  stones: [],
});

export const emptyCost = (category: CostCategory = "metal"): CostForm => ({
  key: newKey(),
  category,
  description: "",
  supplierId: null,
  materialId: null,
  quantity: "1",
  unitCost: "",
});

export const emptyPiece = (origin: Jewelry["origin"] = "on_hand"): PieceForm => ({
  description: "",
  origin,
  manufactureDate: null,
  sameMetalForAll: true,
  metal: "gold",
  purity: "18K",
  metalColor: "yellow",
  weightG: "",
  notes: "",
  components: [],
  costs: [],
  images: [],
});

/** Which measurement fields apply to a part type. */
export const FIELDS_BY_TYPE: Record<JewelryComponent["type"], { ringSize?: true; earringBack?: true; style?: "chain" | "bracelet"; length?: true; width?: true }> = {
  ring: { ringSize: true, width: true },
  earrings: { earringBack: true, length: true },
  pendant: { length: true, width: true },
  chain: { style: "chain", length: true, width: true },
  bracelet: { style: "bracelet", length: true, width: true },
};

const metalOut = (m: MetalForm, use: boolean) => ({
  metal: use ? m.metal : null,
  purity: use ? orNull(m.purity) : null,
  metalColor: use && hasMetalColor(m.metal) ? m.metalColor : null,
  weightG: use ? parseNumber(m.weightG) : null,
});

const metalIn = (m: Pick<Jewelry, "metal" | "purity" | "metalColor" | "weightG">): MetalForm => ({
  metal: m.metal,
  purity: m.purity ?? "",
  metalColor: m.metalColor,
  weightG: numberToInput(m.weightG),
});

export function toDraft(f: PieceForm, units: Units): JewelryDraft {
  return {
    id: f.id,
    description: f.description.trim(),
    origin: f.origin,
    manufactureDate: f.manufactureDate,
    sameMetalForAll: f.sameMetalForAll,
    ...metalOut(f, f.sameMetalForAll),
    notes: orNull(f.notes),
    components: f.components.map((c): ComponentDraft => {
      const applies = FIELDS_BY_TYPE[c.type];
      const ringSize = parseNumber(c.ringSize);
      const length = parseNumber(c.length);
      return {
        id: c.id,
        type: c.type,
        ...metalOut(c, !f.sameMetalForAll),
        ringSizeMm: applies.ringSize && ringSize !== null ? round(ringSizeToMm(ringSize, units.ringSizeSystem)) : null,
        earringBack: applies.earringBack ? c.earringBack : null,
        lengthMm: applies.length && length !== null ? round(lengthToMm(length, units.lengthUnit)) : null,
        style: applies.style ? c.style : null,
        widthMm: applies.width ? parseNumber(c.widthMm) : null,
        notes: orNull(c.notes),
        stones: c.stones.map((s) => ({
          id: s.id,
          stoneKind: s.stoneKind,
          gemName: orNull(s.gemName),
          shape: s.shape,
          quantity: parseNumber(s.quantity) ?? 0,
          sizeMm: parseNumber(s.sizeMm),
          totalCarat: parseNumber(s.totalCarat),
          colorGrade: orNull(s.colorGrade),
          setting: s.setting,
          supplierId: s.supplierId,
          unitCost: parseMoney(s.unitCost),
          materialId: null,
          notes: orNull(s.notes),
        })),
      };
    }),
    costs: f.costs.map((c) => ({
      id: c.id,
      category: c.category,
      description: orNull(c.description),
      supplierId: c.supplierId,
      materialId: c.materialId,
      quantity: parseNumber(c.quantity) ?? 0,
      unitCost: parseMoney(c.unitCost) ?? Number.NaN,
    })),
    images: f.images.map((im) => ({
      id: im.id,
      storageKey: im.storageKey,
      source: im.source,
      aiPrompt: im.aiPrompt,
      isPrimary: im.isPrimary,
      localUri: im.localUri,
    })),
  };
}

export function fromDetail(d: JewelryDetail, units: Units): PieceForm {
  const j = d.jewelry;
  return {
    id: j.id,
    description: j.description,
    origin: j.origin,
    manufactureDate: j.manufactureDate,
    sameMetalForAll: j.sameMetalForAll,
    ...metalIn(j),
    notes: j.notes ?? "",
    components: d.components.map((c) => ({
      key: c.id,
      id: c.id,
      type: c.type,
      ...metalIn(c),
      ringSize: c.ringSizeMm ? String(nearestRingSize(c.ringSizeMm, units.ringSizeSystem)) : "",
      earringBack: c.earringBack,
      length: c.lengthMm ? numberToInput(mmToLength(c.lengthMm, units.lengthUnit), 2) : "",
      style: c.style,
      widthMm: numberToInput(c.widthMm),
      notes: c.notes ?? "",
      stones: c.stones.map((s) => ({
        key: s.id,
        id: s.id,
        stoneKind: s.stoneKind,
        gemName: s.gemName ?? "",
        shape: s.shape,
        quantity: String(s.quantity),
        sizeMm: numberToInput(s.sizeMm),
        totalCarat: numberToInput(s.totalCarat, 3),
        colorGrade: s.colorGrade ?? "",
        setting: s.setting,
        supplierId: s.supplierId,
        unitCost: s.unitCost === null ? "" : moneyToInput(s.unitCost),
        notes: s.notes ?? "",
      })),
    })),
    costs: d.costs.map((c) => ({
      key: c.id,
      id: c.id,
      category: c.category,
      description: c.description ?? "",
      supplierId: c.supplierId,
      materialId: c.materialId,
      quantity: numberToInput(c.quantity, 3),
      unitCost: moneyToInput(c.unitCost),
    })),
    images: d.images.map((im) => ({
      key: im.id,
      id: im.id,
      localUri: im.localUri,
      storageKey: im.storageKey,
      source: im.source,
      aiPrompt: im.aiPrompt,
      isPrimary: im.isPrimary,
    })),
  };
}

export type FormErrors = Record<string, string>;

/** Checks what the user can fix inline; record-level rules are enforced again on save. */
export function validate(f: PieceForm): FormErrors {
  const e: FormErrors = {};
  const num = (path: string, v: string, opts: { positive?: boolean; integer?: boolean } = {}) => {
    if (v.trim() === "") return;
    const n = parseNumber(v);
    if (n === null || !Number.isFinite(n) || n < 0) e[path] = "Enter a valid number";
    else if (opts.positive && n <= 0) e[path] = "Must be more than 0";
    else if (opts.integer && !Number.isInteger(n)) e[path] = "Enter a whole number";
  };
  if (!f.description.trim()) e.description = "Describe the piece";
  if (f.components.length === 0) e.components = "Choose what you are making";
  num("weightG", f.weightG);
  f.components.forEach((c, i) => {
    num(`components.${i}.weightG`, c.weightG);
    num(`components.${i}.ringSize`, c.ringSize);
    num(`components.${i}.length`, c.length);
    num(`components.${i}.widthMm`, c.widthMm);
    c.stones.forEach((s, k) => {
      const p = `components.${i}.stones.${k}`;
      if (!s.quantity.trim()) e[`${p}.quantity`] = "Required";
      num(`${p}.quantity`, s.quantity, { positive: true, integer: true });
      num(`${p}.sizeMm`, s.sizeMm);
      num(`${p}.totalCarat`, s.totalCarat);
      if (s.unitCost.trim() && parseMoney(s.unitCost) === null) e[`${p}.unitCost`] = "Enter an amount";
    });
  });
  f.costs.forEach((c, i) => {
    if (!c.quantity.trim()) e[`costs.${i}.quantity`] = "Required";
    num(`costs.${i}.quantity`, c.quantity, { positive: true });
    if (parseMoney(c.unitCost) === null) e[`costs.${i}.unitCost`] = "Enter an amount";
  });
  return e;
}

const round = (n: number) => Math.round(n * 100) / 100;

// ── Steps ───────────────────────────────────────────────────────────────

export const STEPS = [
  { key: "type", label: "Type" },
  { key: "metal", label: "Metal" },
  { key: "details", label: "Sizes" },
  { key: "stones", label: "Stones" },
  { key: "costs", label: "Costs" },
  { key: "finish", label: "Finish" },
] as const;
export type StepKey = (typeof STEPS)[number]["key"];

const STEP_ERRORS: Record<StepKey, RegExp> = {
  type: /^components$/,
  metal: /^(weightG|components\.\d+\.weightG)$/,
  details: /^components\.\d+\.(ringSize|length|widthMm)$/,
  stones: /^components\.\d+\.stones\./,
  costs: /^costs\./,
  finish: /^description$/,
};

/** The step a validation error belongs to, so the form can open it. */
export function stepOfError(path: string): number {
  const i = STEPS.findIndex((s) => STEP_ERRORS[s.key].test(path));
  return i === -1 ? STEPS.length - 1 : i;
}

export function errorsForStep(errors: FormErrors, step: number): FormErrors {
  return Object.fromEntries(Object.entries(errors).filter(([path]) => stepOfError(path) === step));
}

// ── Derived values ─────────────────────────────────────────────────────

type PartType = JewelryComponent["type"];

/** Keeps parts whose type is still chosen (with their details) and adds new ones, in catalogue order. */
export function withPartTypes(f: PieceForm, types: readonly PartType[]): ComponentForm[] {
  const kept = f.components.filter((c) => types.includes(c.type));
  const added = types.filter((t) => !kept.some((c) => c.type === t)).map((t) => emptyComponent(t));
  const order = (t: PartType) => COMPONENT_TYPES.values.indexOf(t);
  return [...kept, ...added].sort((a, b) => order(a.type) - order(b.type));
}

/** Total metal weight entered so far, as typed (for prefilling the metal cost). */
export function formWeight(f: PieceForm): string {
  if (f.sameMetalForAll) return f.weightG;
  const sum = f.components.reduce((s, c) => s + (parseNumber(c.weightG) ?? 0), 0);
  return sum ? numberToInput(sum, 2) : "";
}

/** Running totals in centavos; lines that are not filled in yet count as zero. */
export function formTotals(f: PieceForm): { stones: number; costs: number; total: number } {
  const stones = f.components
    .flatMap((c) => c.stones)
    .reduce((s, st) => s + (parseNumber(st.quantity) ?? 0) * (parseMoney(st.unitCost) ?? 0), 0);
  const costs = f.costs.reduce((s, c) => {
    const unit = parseMoney(c.unitCost);
    const qty = parseNumber(c.quantity);
    return s + (unit !== null && qty ? lineTotal(qty, unit) : 0);
  }, 0);
  return { stones: Math.round(stones), costs, total: Math.round(stones) + costs };
}

const STONE_WORDS: Record<JewelryStone["stoneKind"], string> = {
  natural_diamond: "diamond",
  lab_grown_diamond: "lab-grown diamond",
  moissanite: "moissanite",
  cubic_zirconia: "cubic zirconia",
  gemstone: "gemstone",
  other: "stone",
};

function metalWords(m: MetalForm): string {
  if (m.metal === "gold") {
    const colour = m.metalColor ? METAL_COLORS.labels[m.metalColor].toLowerCase() : null;
    return [m.purity || null, colour, "gold"].filter(Boolean).join(" ");
  }
  if (m.metal === "silver") return [m.purity || null, "silver"].filter(Boolean).join(" ");
  return "";
}

/** A plain description from the choices made, e.g. "18K yellow gold ring with 3 diamonds". */
export function suggestDescription(f: PieceForm): string {
  const type = pieceType(f.components.map((c) => c.type));
  if (!type) return "";
  const what =
    type === "set"
      ? `${f.components.map((c) => COMPONENT_TYPES.labels[c.type].toLowerCase()).join(" and ")} set`
      : PIECE_TYPES.labels[type].toLowerCase();
  const metal = f.sameMetalForAll ? metalWords(f) : "";
  const stones = f.components.flatMap((c) => c.stones);
  const count = stones.reduce((s, st) => s + (parseNumber(st.quantity) ?? 0), 0);
  const kinds = new Set(stones.map((s) => (s.stoneKind === "gemstone" && s.gemName.trim() ? s.gemName.trim().toLowerCase() : STONE_WORDS[s.stoneKind])));
  let withStones = "";
  if (count > 0) {
    const word = kinds.size === 1 ? [...kinds][0]! : "stone";
    const plural = count > 1 && /(diamond|stone|gemstone|ruby|sapphire|emerald|pearl)$/.test(word) ? (word.endsWith("y") ? `${word.slice(0, -1)}ies` : `${word}s`) : word;
    withStones = ` with ${count} ${plural}`;
  }
  const text = [metal, what].filter(Boolean).join(" ") + withStones;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
