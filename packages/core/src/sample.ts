import type { FieldsInput, TableName } from "@jewelry/shared";
import { saveJewelry, saveJobOrder, savePurchase, type ComponentDraft, type JewelryDraft } from "./aggregates";
import type { Store } from "./store";

/**
 * Sample records for trying the app: clients, suppliers, materials, a few
 * purchases, and pieces and orders spread over the last eighteen months.
 * Every sample record id starts with `sample-` so the set can be removed again.
 */

export const SAMPLE_PREFIX = "sample-";

const sid = (kind: string, n: number) => `${SAMPLE_PREFIX}${kind}-${String(n).padStart(4, "0")}`;

/** Small deterministic generator so every load produces the same records. */
function random(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
    chance: (p: number) => next() < p,
  };
}

const FIRST = ["Maria", "Ana", "Kristine", "Jasmine", "Patricia", "Camille", "Bea", "Nicole", "Angela", "Rachel", "Carmela", "Jose", "Miguel", "Paolo", "Rafael", "Carlo", "Gabriel", "Marco", "Joaquin", "Liza", "Teresa", "Rosario", "Divina", "Isabel"];
const LAST = ["Santos", "Reyes", "Cruz", "Bautista", "Garcia", "Mendoza", "Torres", "Villanueva", "Ramos", "Aquino", "Dela Cruz", "Navarro", "Castillo", "Fernandez", "Lim", "Tan", "Go", "Uy", "Domingo", "Salazar"];
const CITIES = ["Quezon City", "Makati", "Pasig", "Mandaluyong", "Marikina", "Taguig", "Parañaque", "Las Piñas", "Antipolo", "Meycauayan, Bulacan"];

const SUPPLIERS = [
  { name: "Meycauayan Gold Traders", address: "Meycauayan, Bulacan" },
  { name: "Ongpin Gem Center", address: "Ongpin St, Binondo, Manila" },
  { name: "Sta. Cruz Findings Supply", address: "Sta. Cruz, Manila" },
  { name: "Mang Ruben's Plating", address: "Meycauayan, Bulacan" },
];

type Metal = "gold" | "silver";
type Shape = FieldsInput<"jewelryStones">["shape"];
type Kind = FieldsInput<"jewelryStones">["stoneKind"];

/** Price per gram in centavos. */
const GRAM_PRICE: Record<string, number> = { "10K": 220_000, "14K": 310_000, "18K": 420_000, "21K": 480_000, "925": 9_000 };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const COLOR_WORD = { yellow: "yellow", white: "white", rose: "rose", two_tone: "two-tone" } as const;

export type SampleCounts = { clients: number; pieces: number; orders: number };

/** Adds the sample records. Loading again replaces the earlier set. */
export async function seedSampleData(store: Store, opts: { today?: Date; pieces?: number } = {}): Promise<SampleCounts> {
  const today = opts.today ?? new Date();
  const pieceCount = opts.pieces ?? 160;
  const r = random(20_240_917);
  const daysAgo = (n: number) => isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - n));

  await clearSampleData(store);

  return store.transaction(async () => {
    // ── People ──────────────────────────────────────────────────────────
    const clients: string[] = [];
    for (let i = 1; i <= 36; i++) {
      const id = sid("client", i);
      await store.insert(
        "clients",
        {
          firstName: FIRST[(i * 7) % FIRST.length]!,
          lastName: LAST[(i * 3 + Math.floor(i / 7)) % LAST.length]!,
          phone: `09${r.int(15, 99)}${r.int(100, 999)}${r.int(1000, 9999)}`,
          address: r.chance(0.6) ? r.pick(CITIES) : null,
          notes: r.chance(0.15) ? "Prefers GCash. Message before calling." : null,
        },
        { id },
      );
      clients.push(id);
    }

    const suppliers: string[] = [];
    for (const [i, s] of SUPPLIERS.entries()) {
      const id = sid("supplier", i + 1);
      await store.insert("suppliers", { ...s, phone: `0917${r.int(100, 999)}${r.int(1000, 9999)}`, notes: null }, { id });
      suppliers.push(id);
    }
    const [goldSupplier, gemSupplier, findingSupplier, plater] = suppliers as [string, string, string, string];

    // ── Materials and purchases ─────────────────────────────────────────
    const materials = [
      { name: "18K gold", kind: "metal", unit: "g", metal: "gold", purity: "18K", price: GRAM_PRICE["18K"]! },
      { name: "14K gold", kind: "metal", unit: "g", metal: "gold", purity: "14K", price: GRAM_PRICE["14K"]! },
      { name: "925 silver", kind: "metal", unit: "g", metal: "silver", purity: "925", price: GRAM_PRICE["925"]! },
      { name: "Cubic zirconia 3 mm", kind: "stone", unit: "pc", metal: null, purity: null, price: 2_500 },
      { name: "Butterfly earring backs", kind: "finding", unit: "pc", metal: null, purity: null, price: 1_500 },
    ] as const;
    const materialIds: string[] = [];
    for (const [i, m] of materials.entries()) {
      const id = sid("material", i + 1);
      const { price: _price, ...fields } = m;
      await store.insert("materials", { ...fields, notes: null }, { id });
      materialIds.push(id);
    }
    for (let i = 0; i < 8; i++) {
      await savePurchase(store, {
        id: sid("purchase", i + 1),
        supplierId: i % 3 === 2 ? findingSupplier : goldSupplier,
        purchaseDate: daysAgo(500 - i * 60),
        notes: null,
        lines: (i % 3 === 2 ? [3, 4] : [0, 2]).map((m, j) => ({
          id: sid(`pline-${i + 1}`, j + 1),
          materialId: materialIds[m]!,
          quantity: materials[m]!.unit === "g" ? r.int(20, 60) : r.int(50, 200),
          unitPrice: materials[m]!.price,
        })),
      });
    }

    // ── Pieces ──────────────────────────────────────────────────────────
    type Made = { id: string; date: string; cost: number };
    const pieces: Made[] = [];

    for (let n = 1; n <= pieceCount; n++) {
      const id = sid("piece", n);
      // Spread over eighteen months, oldest first, so codes follow dates.
      const age = Math.round(540 - (n / pieceCount) * 535) + r.int(0, 4);
      const metal: Metal = r.chance(0.82) ? "gold" : "silver";
      const purity = metal === "gold" ? r.pick(["18K", "18K", "14K", "21K", "10K"] as const) : "925";
      const color = metal === "gold" ? r.pick(["yellow", "yellow", "white", "rose", "two_tone"] as const) : null;
      const kind = r.pick(["ring", "ring", "ring", "earrings", "pendant_set", "chain", "bracelet"] as const);

      let c = 0;
      let s = 0;
      const stone = (
        stoneKind: Kind,
        shape: Shape,
        quantity: number,
        sizeMm: number,
        unitCost: number,
        extra: Partial<FieldsInput<"jewelryStones">> = {},
      ) => ({
        id: sid(`stone-${n}`, ++s),
        stoneKind,
        gemName: null,
        shape,
        quantity,
        sizeMm,
        totalCarat: null,
        colorGrade: null,
        setting: "prong" as const,
        unitCost,
        supplierId: gemSupplier,
        materialId: null,
        notes: null,
        ...extra,
      });
      const part = (type: ComponentDraft["type"], fields: Partial<ComponentDraft> = {}): ComponentDraft => ({
        id: sid(`part-${n}`, ++c),
        type,
        metal: null,
        purity: null,
        metalColor: null,
        weightG: null,
        ringSizeMm: null,
        earringBack: null,
        lengthMm: null,
        style: null,
        widthMm: null,
        notes: null,
        stones: [],
        ...fields,
      });

      let components: ComponentDraft[];
      let what: string;
      let weight: number;
      if (kind === "ring") {
        const style = r.pick(["solitaire", "band", "halo", "signet", "eternity"] as const);
        weight = style === "band" || style === "signet" ? r.int(30, 70) / 10 : r.int(18, 40) / 10;
        const stones =
          style === "solitaire"
            ? [stone(r.pick(["moissanite", "lab_grown_diamond", "natural_diamond"] as const), r.pick(["round", "oval", "princess", "cushion"] as const), 1, r.pick([5, 6, 6.5]), r.pick([350_000, 900_000, 2_500_000]))]
            : style === "halo"
              ? [
                  stone("moissanite", r.pick(["round", "oval", "pear"] as const), 1, 6, 350_000),
                  stone("cubic_zirconia", "round", r.int(14, 20), 1.5, 2_500, { setting: "halo" }),
                ]
              : style === "eternity"
                ? [stone(r.pick(["cubic_zirconia", "moissanite"] as const), "round", r.int(18, 26), 2, 6_000, { setting: "channel" })]
                : style === "signet" && r.chance(0.4)
                  ? [stone("gemstone", "cabochon", 1, 8, 180_000, { gemName: r.pick(["Onyx", "Jade", "Ruby"]), setting: "bezel" })]
                  : [];
        components = [part("ring", { ringSizeMm: r.int(155, 195) / 10, widthMm: style === "band" ? r.int(3, 6) : null, stones })];
        what = `${style} ring`;
      } else if (kind === "earrings") {
        const style = r.pick(["studs", "huggies", "drops"] as const);
        weight = r.int(15, 45) / 10;
        components = [
          part("earrings", {
            earringBack: style === "huggies" ? "huggie" : style === "drops" ? "hook" : "push_back",
            stones: style === "huggies" && r.chance(0.5) ? [] : [stone(r.pick(["cubic_zirconia", "moissanite", "gemstone"] as const), r.pick(["round", "pear", "heart"] as const), 2, r.pick([3, 4, 5]), r.pick([5_000, 120_000, 90_000]), { gemName: null })],
          }),
        ];
        what = `${style === "studs" ? "stud" : style === "huggies" ? "huggie" : "drop"} earrings`;
      } else if (kind === "pendant_set") {
        weight = r.int(30, 60) / 10;
        const pendant = r.pick(["cross", "initial", "heart", "Sto. Niño", "solitaire"] as const);
        components = [
          part("pendant", {
            stones: pendant === "solitaire" || pendant === "heart" ? [stone(r.pick(["moissanite", "cubic_zirconia"] as const), pendant === "heart" ? "heart" : "round", 1, 5, 80_000)] : [],
          }),
          part("chain", { style: r.pick(["cable", "box", "singapore", "rope"] as const), lengthMm: r.pick([406, 457, 508]) }),
        ];
        what = `${pendant} pendant with chain`;
      } else if (kind === "chain") {
        const style = r.pick(["cuban", "franco", "rope", "singapore", "figaro", "box"] as const);
        weight = r.int(50, 220) / 10;
        components = [part("chain", { style, lengthMm: r.pick([457, 508, 559, 610]), widthMm: r.int(2, 6) })];
        what = `${style} chain`;
      } else {
        const style = r.pick(["bangle", "tennis", "chain", "charm"] as const);
        weight = r.int(40, 150) / 10;
        components = [
          part("bracelet", {
            style,
            lengthMm: r.pick([165, 178, 190]),
            stones: style === "tennis" ? [stone("cubic_zirconia", "round", r.int(30, 45), 2.5, 3_000)] : [],
          }),
        ];
        what = `${style === "chain" ? "chain" : style} bracelet`;
      }

      const metalLabel = metal === "gold" ? `${purity} ${COLOR_WORD[color!]} gold` : "925 silver";
      const gram = GRAM_PRICE[purity]!;
      let k = 0;
      const cost = (category: FieldsInput<"jewelryCosts">["category"], unitCost: number, extra: Partial<FieldsInput<"jewelryCosts">> = {}) => ({
        id: sid(`cost-${n}`, ++k),
        category,
        description: null,
        supplierId: null,
        materialId: null,
        quantity: 1,
        unitCost,
        ...extra,
      });
      const costs = [
        cost("metal", gram, { quantity: weight, supplierId: goldSupplier, description: metalLabel }),
        cost("labor", r.pick([80_000, 120_000, 150_000, 250_000]), { description: r.pick(["Casting and polishing", "Stone setting", "Hand fabrication", "Assembly and polishing"]) }),
      ];
      if (color === "white" || metal === "silver" || r.chance(0.15)) {
        costs.push(cost("plating", r.pick([30_000, 50_000]), { supplierId: plater, description: color === "white" || metal === "silver" ? "Rhodium" : "Gold plating" }));
      }
      if (r.chance(0.18)) costs.push(cost("engraving", r.pick([25_000, 50_000]), { description: r.pick(["Initials inside band", "Date and name", "Laser engraving"]) }));
      if (r.chance(0.1)) costs.push(cost("other", 15_000, { description: "Gift box" }));

      const draft: JewelryDraft = {
        id,
        description: `${metalLabel} ${what}`.replace(/^./, (ch) => ch.toUpperCase()),
        origin: r.chance(0.55) ? "made_to_order" : "on_hand",
        manufactureDate: daysAgo(age),
        sameMetalForAll: true,
        metal,
        purity,
        metalColor: color,
        weightG: weight,
        notes: null,
        components,
        costs,
        images: [],
      };
      await saveJewelry(store, draft);
      const stoneCost = components.flatMap((p) => p.stones).reduce((t, st) => t + st.quantity * (st.unitCost ?? 0), 0);
      pieces.push({ id, date: daysAgo(age), cost: Math.round(costs.reduce((t, x) => t + x.quantity * x.unitCost, 0)) + stoneCost });
    }

    // ── Orders ──────────────────────────────────────────────────────────
    // About three in four pieces are sold; the rest stay available.
    let orders = 0;
    let i = 0;
    while (i < pieces.length) {
      if (r.chance(0.22)) {
        i++;
        continue;
      }
      const take = r.chance(0.2) ? 2 : 1;
      const items = pieces.slice(i, i + take);
      i += take;
      const orderDate = items.at(-1)!.date;
      const age = Math.round((today.getTime() - new Date(`${orderDate}T00:00:00`).getTime()) / 86_400_000);
      const status = age > 45 || (age > 14 && r.chance(0.4)) ? "completed" : "in_production";
      const priced = items.map((p) => ({ jewelryId: p.id, sellingPrice: Math.round((p.cost * (1.35 + r.next() * 0.4)) / 10_000) * 10_000 }));
      const total = priced.reduce((t, x) => t + x.sellingPrice, 0);
      const id = sid("order", ++orders);
      await saveJobOrder(store, {
        id,
        clientId: r.pick(clients),
        orderDate,
        status,
        notes: r.chance(0.1) ? "Rush: needed for a wedding." : null,
        items: priced,
      });

      // Down payment on most orders; completed ones are usually settled in full.
      const owed = status === "completed" ? (r.chance(0.85) ? total : Math.round(total * 0.7)) : r.chance(0.8) ? Math.round(total * 0.5) : 0;
      let paid = 0;
      let p = 0;
      const pay = (amount: number, at: string) =>
        store.insert(
          "payments",
          { jobOrderId: id, amount, paidAt: at, method: r.pick(["cash", "gcash", "gcash", "bank_transfer", "maya"] as const), notes: null },
          { id: sid(`payment-${orders}`, ++p) },
        );
      if (owed > 0) {
        const down = Math.min(owed, Math.round(total * 0.5));
        await pay(down, orderDate);
        paid += down;
        if (owed > paid) await pay(owed - paid, daysAgo(Math.max(0, age - r.int(7, 25))));
      }
    }

    return { clients: clients.length, pieces: pieces.length, orders };
  });
}

const SAMPLE = `id LIKE '${SAMPLE_PREFIX}%'`;
const under = (table: TableName, column: string, where = SAMPLE) => `${column} IN (SELECT id FROM ${table} WHERE ${where})`;
const SAMPLE_ORDERS = `${SAMPLE} OR ${under("clients", "clientId")}`;

/** Which rows go with the sample set, children before parents. */
const SAMPLE_ROWS: [TableName, string][] = [
  ["payments", `${SAMPLE} OR ${under("jobOrders", "jobOrderId", SAMPLE_ORDERS)}`],
  ["jobOrderItems", `${SAMPLE} OR ${under("jobOrders", "jobOrderId", SAMPLE_ORDERS)} OR ${under("jewelries", "jewelryId")}`],
  ["jobOrders", SAMPLE_ORDERS],
  ["jewelryImages", `${SAMPLE} OR ${under("jewelries", "jewelryId")}`],
  ["jewelryCosts", `${SAMPLE} OR ${under("jewelries", "jewelryId")}`],
  ["jewelryStones", `${SAMPLE} OR ${under("jewelryComponents", "componentId", `${SAMPLE} OR ${under("jewelries", "jewelryId")}`)}`],
  ["jewelryComponents", `${SAMPLE} OR ${under("jewelries", "jewelryId")}`],
  ["jewelries", SAMPLE],
  ["stockAdjustments", `${SAMPLE} OR ${under("materials", "materialId")}`],
  ["purchaseLines", `${SAMPLE} OR ${under("purchases", "purchaseId", `${SAMPLE} OR ${under("suppliers", "supplierId")}`)} OR ${under("materials", "materialId")}`],
  ["purchases", `${SAMPLE} OR ${under("suppliers", "supplierId")}`],
  ["materials", SAMPLE],
  ["suppliers", SAMPLE],
  ["clients", SAMPLE],
];

/** Whether sample records are loaded. */
export async function hasSampleData(store: Store): Promise<boolean> {
  const [row] = await store.query<{ n: number }>("SELECT COUNT(*) AS n FROM clients WHERE id LIKE ?", [`${SAMPLE_PREFIX}%`]);
  return (row?.n ?? 0) > 0;
}

/**
 * Removes every sample record and anything attached to one, without leaving
 * tombstones: sample data stays on the device and never syncs.
 */
export async function clearSampleData(store: Store): Promise<void> {
  await store.transaction(async () => {
    // Collect first: children of sample parents may not carry the prefix themselves.
    const doomed: [TableName, string[]][] = [];
    for (const [table, where] of SAMPLE_ROWS) {
      const rows = await store.query<{ id: string }>(`SELECT id FROM ${table} WHERE ${where}`);
      doomed.push([table, rows.map((x) => x.id)]);
    }
    for (const [table, ids] of doomed) {
      for (let at = 0; at < ids.length; at += 500) {
        const chunk = ids.slice(at, at + 500);
        const marks = chunk.map(() => "?").join(", ");
        await store.db.run(`DELETE FROM outbox WHERE tableName = ? AND recordId IN (${marks})`, [table, ...chunk]);
        await store.db.run(`DELETE FROM ${table} WHERE id IN (${marks})`, chunk);
      }
    }
    store.changed(SAMPLE_ROWS.map(([t]) => t));
  });
}
