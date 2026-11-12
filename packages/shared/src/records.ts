import { z } from "zod";
import {
  BRACELET_STYLES,
  CHAIN_STYLES,
  COMPONENT_TYPES,
  COST_CATEGORIES,
  EARRING_BACKS,
  IMAGE_SOURCES,
  LENGTH_UNITS,
  MATERIAL_KINDS,
  METAL_COLORS,
  METALS,
  ORDER_STATUSES,
  ORIGINS,
  PAYMENT_METHODS,
  RING_SIZE_SYSTEMS,
  STOCK_REASONS,
  STONE_KINDS,
  STONE_SETTINGS,
  STONE_SHAPES,
  UNITS,
} from "./enums";
import { parsePhPhone } from "./phone";

/**
 * Record schemas — the single definition of every table, shared by the
 * on-device SQLite store, the sync protocol and server-side validation.
 * Optional values are `null` (not undefined) to mirror SQL NULL.
 */

const id = z.string().min(10).max(40);
const ref = id;
const optRef = id.nullable();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const timestamp = z.string().datetime();
const name = (max: number) => z.string().trim().min(1, "Required").max(max);
const optText = (max: number) => z.string().trim().max(max).nullable();
const money = z.number().int().min(0).max(1_000_000_000_000);
const measure = z.number().min(0).max(1_000_000);
const optMeasure = measure.nullable();
const e = <T extends readonly [string, ...string[]]>(o: { values: T }) => z.enum(o.values);

const phone = z
  .string()
  .refine((v) => parsePhPhone(v) !== null, "Enter a valid PH mobile or landline number")
  .transform((v) => parsePhPhone(v)!.e164);

export const metaSchema = z.object({
  id,
  createdAt: timestamp,
  updatedAt: timestamp,
  /** Soft delete: moved to Trash. */
  deletedAt: timestamp.nullable(),
  /** In Trash past the retention window but still referenced: hidden, kept for history. */
  archivedAt: timestamp.nullable(),
  /** Permanently removed; only a tombstone remains so the removal syncs. */
  purgedAt: timestamp.nullable(),
});
export type Meta = z.infer<typeof metaSchema>;

const metalFields = {
  metal: e(METALS).nullable(),
  purity: optText(10),
  metalColor: e(METAL_COLORS).nullable(),
  weightG: optMeasure,
};

export const fieldSchemas = {
  clients: z.object({
    firstName: name(60),
    lastName: name(60),
    phone,
    address: optText(300),
    notes: optText(2000),
  }),
  suppliers: z.object({
    name: name(120),
    phone,
    address: optText(300),
    notes: optText(2000),
  }),
  materials: z.object({
    name: name(120),
    kind: e(MATERIAL_KINDS),
    unit: e(UNITS),
    metal: e(METALS).nullable(),
    purity: optText(10),
    notes: optText(2000),
  }),
  purchases: z.object({
    supplierId: ref,
    purchaseDate: date,
    notes: optText(2000),
  }),
  purchaseLines: z.object({
    purchaseId: ref,
    materialId: ref,
    quantity: measure.positive(),
    unitPrice: money,
  }),
  stockAdjustments: z.object({
    materialId: ref,
    quantity: z.number().min(-1_000_000).max(1_000_000).refine((v) => v !== 0, "Cannot be zero"),
    reason: e(STOCK_REASONS),
    date,
    notes: optText(2000),
  }),
  jewelries: z.object({
    code: z.string().max(20).nullable(),
    description: name(1000),
    origin: e(ORIGINS),
    manufactureDate: date.nullable(),
    sameMetalForAll: z.boolean(),
    ...metalFields,
    notes: optText(2000),
  }),
  jewelryComponents: z.object({
    jewelryId: ref,
    type: e(COMPONENT_TYPES),
    sortOrder: z.number().int().min(0),
    ...metalFields,
    ringSizeMm: optMeasure,
    earringBack: e(EARRING_BACKS).nullable(),
    lengthMm: optMeasure,
    style: z.union([e(CHAIN_STYLES), e(BRACELET_STYLES)]).nullable(),
    widthMm: optMeasure,
    notes: optText(2000),
  }),
  jewelryStones: z.object({
    componentId: ref,
    stoneKind: e(STONE_KINDS),
    gemName: optText(40),
    shape: e(STONE_SHAPES).nullable(),
    quantity: z.number().int().min(1).max(100_000),
    sizeMm: optMeasure,
    totalCarat: optMeasure,
    colorGrade: optText(10),
    clarityGrade: optText(10),
    setting: e(STONE_SETTINGS).nullable(),
    supplierId: optRef,
    materialId: optRef,
    notes: optText(2000),
  }),
  jewelryCosts: z.object({
    jewelryId: ref,
    category: e(COST_CATEGORIES),
    description: optText(200),
    supplierId: optRef,
    workerName: optText(80),
    materialId: optRef,
    quantity: measure.positive(),
    unitCost: money,
  }),
  jewelryImages: z.object({
    jewelryId: ref,
    storageKey: z.string().max(300).nullable(),
    source: e(IMAGE_SOURCES),
    aiPrompt: optText(2000),
    isPrimary: z.boolean(),
    sortOrder: z.number().int().min(0),
  }),
  jobOrders: z.object({
    code: z.string().max(20).nullable(),
    clientId: ref,
    orderDate: date,
    status: e(ORDER_STATUSES),
    notes: optText(2000),
  }),
  jobOrderItems: z.object({
    jobOrderId: ref,
    jewelryId: ref,
    sellingPrice: money,
  }),
  payments: z.object({
    jobOrderId: ref,
    amount: money.positive(),
    paidAt: date,
    method: e(PAYMENT_METHODS),
    notes: optText(2000),
  }),
  settings: z.object({
    currency: z.string().length(3),
    defaultMarkupPct: z.number().min(0).max(1000),
    lengthUnit: e(LENGTH_UNITS),
    ringSizeSystem: e(RING_SIZE_SYSTEMS),
    materialTracking: z.boolean(),
  }),
} as const;

export type TableName = keyof typeof fieldSchemas;

/** Sync/apply order: parents before children. */
export const TABLES: readonly TableName[] = [
  "settings",
  "clients",
  "suppliers",
  "materials",
  "purchases",
  "purchaseLines",
  "stockAdjustments",
  "jewelries",
  "jewelryComponents",
  "jewelryStones",
  "jewelryCosts",
  "jewelryImages",
  "jobOrders",
  "jobOrderItems",
  "payments",
];

export const isTableName = (v: unknown): v is TableName =>
  typeof v === "string" && (TABLES as readonly string[]).includes(v);

export type Fields<T extends TableName> = z.output<(typeof fieldSchemas)[T]>;
export type FieldsInput<T extends TableName> = z.input<(typeof fieldSchemas)[T]>;
export type RecordOf<T extends TableName> = Meta & Fields<T>;

export type Client = RecordOf<"clients">;
export type Supplier = RecordOf<"suppliers">;
export type Material = RecordOf<"materials">;
export type Purchase = RecordOf<"purchases">;
export type PurchaseLine = RecordOf<"purchaseLines">;
export type StockAdjustment = RecordOf<"stockAdjustments">;
export type Jewelry = RecordOf<"jewelries">;
export type JewelryComponent = RecordOf<"jewelryComponents">;
export type JewelryStone = RecordOf<"jewelryStones">;
export type JewelryCost = RecordOf<"jewelryCosts">;
export type JewelryImage = RecordOf<"jewelryImages">;
export type JobOrder = RecordOf<"jobOrders">;
export type JobOrderItem = RecordOf<"jobOrderItems">;
export type Payment = RecordOf<"payments">;
export type Settings = RecordOf<"settings">;

export const fieldNames = <T extends TableName>(table: T): (keyof Fields<T> & string)[] =>
  Object.keys(fieldSchemas[table].shape) as (keyof Fields<T> & string)[];

export const BOOLEAN_FIELDS: Partial<Record<TableName, readonly string[]>> = {
  jewelries: ["sameMetalForAll"],
  jewelryImages: ["isPrimary"],
  settings: ["materialTracking"],
};

/** Tables whose records get a sequential, human-readable code assigned by the server. */
export const CODE_PREFIXES: Partial<Record<TableName, string>> = {
  jewelries: "JW",
  jobOrders: "JO",
};

export const formatCode = (prefix: string, n: number) => `${prefix}-${String(n).padStart(5, "0")}`;

export const SETTINGS_ID = "settings-singleton";

export const DEFAULT_SETTINGS: Fields<"settings"> = {
  currency: "PHP",
  defaultMarkupPct: 30,
  lengthUnit: "in",
  ringSizeSystem: "us",
  materialTracking: false,
};

/**
 * Foreign keys. `cascade` children are soft-deleted (and restored) together with
 * their parent; other references keep the parent alive as history.
 */
export type Relation = { table: TableName; column: string; parent: TableName; cascade: boolean };

export const RELATIONS: readonly Relation[] = [
  { table: "purchases", column: "supplierId", parent: "suppliers", cascade: false },
  { table: "purchaseLines", column: "purchaseId", parent: "purchases", cascade: true },
  { table: "purchaseLines", column: "materialId", parent: "materials", cascade: false },
  { table: "stockAdjustments", column: "materialId", parent: "materials", cascade: false },
  { table: "jewelryComponents", column: "jewelryId", parent: "jewelries", cascade: true },
  { table: "jewelryStones", column: "componentId", parent: "jewelryComponents", cascade: true },
  { table: "jewelryStones", column: "supplierId", parent: "suppliers", cascade: false },
  { table: "jewelryStones", column: "materialId", parent: "materials", cascade: false },
  { table: "jewelryCosts", column: "jewelryId", parent: "jewelries", cascade: true },
  { table: "jewelryCosts", column: "supplierId", parent: "suppliers", cascade: false },
  { table: "jewelryCosts", column: "materialId", parent: "materials", cascade: false },
  { table: "jewelryImages", column: "jewelryId", parent: "jewelries", cascade: true },
  { table: "jobOrders", column: "clientId", parent: "clients", cascade: false },
  { table: "jobOrderItems", column: "jobOrderId", parent: "jobOrders", cascade: true },
  { table: "jobOrderItems", column: "jewelryId", parent: "jewelries", cascade: false },
  { table: "payments", column: "jobOrderId", parent: "jobOrders", cascade: true },
];

export const TRASH_RETENTION_DAYS = 7;

/** Validates a full record (meta + fields) as received over the wire. */
export function parseRecord<T extends TableName>(table: T, raw: unknown): RecordOf<T> {
  const meta = metaSchema.parse(raw);
  if (meta.purgedAt) {
    // Tombstones carry no field data.
    return meta as RecordOf<T>;
  }
  const fields = fieldSchemas[table].parse(raw);
  return { ...meta, ...fields } as RecordOf<T>;
}
