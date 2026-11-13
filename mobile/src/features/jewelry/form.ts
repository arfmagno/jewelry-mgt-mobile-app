import type { ComponentDraft, JewelryDetail, JewelryDraft } from "@jewelry/core";
import {
  hasMetalColor,
  lengthToMm,
  mmToLength,
  moneyToInput,
  parseMoney,
  ringSizeFromMm,
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
  clarityGrade: string;
  setting: JewelryStone["setting"];
  supplierId: string | null;
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
  clarityGrade: "",
  setting: null,
  supplierId: null,
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
  components: [emptyComponent()],
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
          clarityGrade: orNull(s.clarityGrade),
          setting: s.setting,
          supplierId: s.supplierId,
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
      ringSize: c.ringSizeMm ? numberToInput(ringSizeFromMm(c.ringSizeMm, units.ringSizeSystem), 2) : "",
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
        clarityGrade: s.clarityGrade ?? "",
        setting: s.setting,
        supplierId: s.supplierId,
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
  if (f.components.length === 0) e.components = "Add at least one part";
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
