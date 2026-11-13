import {
  costTotal,
  lineTotal,
  orderTotals,
  pieceType,
  stoneTotal,
  totalWeight,
  type Client,
  type Jewelry,
  type JewelryComponent,
  type JewelryCost,
  type JewelryImage,
  type JewelryStone,
  type JobOrder,
  type Material,
  type OrderTotals,
  type Payment,
  type PieceType,
  type Purchase,
  type PurchaseLine,
  type Supplier,
  type TableName,
} from "@jewelry/shared";
import { TRASHABLE } from "./lifecycle";
import type { SqlValue } from "./sqldb";
import type { Store } from "./store";

/** Read models for screens. "Active" = not deleted; history lookups also include deleted/archived rows. */

const ACTIVE = "deletedAt IS NULL AND purgedAt IS NULL";

/** Total cost of a piece in SQL: its cost lines plus its priced stones. */
const pieceCostSql = (jewelryId: string) => `(
  COALESCE((SELECT SUM(ROUND(quantity * unitCost)) FROM jewelryCosts
            WHERE jewelryId = ${jewelryId} AND deletedAt IS NULL), 0)
  + COALESCE((SELECT SUM(s.quantity * s.unitCost) FROM jewelryStones s
              JOIN jewelryComponents pc ON pc.id = s.componentId
              WHERE pc.jewelryId = ${jewelryId} AND s.deletedAt IS NULL AND pc.deletedAt IS NULL), 0))`;
const like = (s: string) => `%${s.replace(/[%_]/g, (m) => `\\${m}`)}%`;

export type PageParams = { limit?: number; offset?: number; search?: string };

// ── Clients ─────────────────────────────────────────────────────────────

export async function listClients(store: Store, p: PageParams = {}): Promise<Client[]> {
  const params: SqlValue[] = [];
  let where = ACTIVE;
  if (p.search?.trim()) {
    where += ` AND (firstName || ' ' || lastName LIKE ? ESCAPE '\\' OR lastName || ' ' || firstName LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\')`;
    const q = like(p.search.trim());
    const digits = p.search.replace(/\D/g, "").replace(/^0/, "");
    params.push(q, q, digits ? like(digits) : q);
  }
  return store.select(
    "clients",
    `${where} ORDER BY lastName COLLATE NOCASE, firstName COLLATE NOCASE LIMIT ? OFFSET ?`,
    [...params, p.limit ?? 50, p.offset ?? 0],
  );
}

// ── Suppliers & materials ───────────────────────────────────────────────

export async function listSuppliers(store: Store, p: PageParams = {}): Promise<Supplier[]> {
  const params: SqlValue[] = [];
  let where = ACTIVE;
  if (p.search?.trim()) {
    where += ` AND name LIKE ? ESCAPE '\\'`;
    params.push(like(p.search.trim()));
  }
  return store.select("suppliers", `${where} ORDER BY name COLLATE NOCASE LIMIT ? OFFSET ?`, [
    ...params,
    p.limit ?? 50,
    p.offset ?? 0,
  ]);
}

export type MaterialWithStock = Material & { stock: number | null };

export async function listMaterials(
  store: Store,
  opts: { search?: string; withStock?: boolean } = {},
): Promise<MaterialWithStock[]> {
  const params: SqlValue[] = [];
  let where = ACTIVE;
  if (opts.search?.trim()) {
    where += ` AND name LIKE ? ESCAPE '\\'`;
    params.push(like(opts.search.trim()));
  }
  const materials = await store.select("materials", `${where} ORDER BY kind, name COLLATE NOCASE`, params);
  return Promise.all(
    materials.map(async (m) => ({ ...m, stock: opts.withStock ? await stockOnHand(store, m.id) : null })),
  );
}

/** Purchased + adjustments − used in pieces (only meaningful when material tracking is on). */
export async function stockOnHand(store: Store, materialId: string): Promise<number> {
  const [row] = await store.query<{ bought: number | null; adjusted: number | null; used: number | null }>(
    `SELECT
       (SELECT SUM(l.quantity) FROM purchaseLines l JOIN purchases p ON p.id = l.purchaseId
         WHERE l.materialId = ?1 AND l.deletedAt IS NULL AND p.deletedAt IS NULL AND l.purgedAt IS NULL) AS bought,
       (SELECT SUM(quantity) FROM stockAdjustments WHERE materialId = ?1 AND ${ACTIVE}) AS adjusted,
       (SELECT SUM(c.quantity) FROM jewelryCosts c JOIN jewelries j ON j.id = c.jewelryId
         WHERE c.materialId = ?1 AND c.deletedAt IS NULL AND j.deletedAt IS NULL AND c.purgedAt IS NULL) AS used`,
    [materialId],
  );
  return (row?.bought ?? 0) + (row?.adjusted ?? 0) - (row?.used ?? 0);
}

/** Unit price from the most recent purchase of a material (optionally from one supplier). */
export async function latestPrice(
  store: Store,
  materialId: string,
  supplierId?: string | null,
): Promise<{ unitPrice: number; supplierId: string; purchaseDate: string } | null> {
  const params: SqlValue[] = [materialId];
  let extra = "";
  if (supplierId) {
    extra = "AND p.supplierId = ?";
    params.push(supplierId);
  }
  const [row] = await store.query<{ unitPrice: number; supplierId: string; purchaseDate: string }>(
    `SELECT l.unitPrice, p.supplierId, p.purchaseDate FROM purchaseLines l JOIN purchases p ON p.id = l.purchaseId
     WHERE l.materialId = ? ${extra} AND l.deletedAt IS NULL AND p.deletedAt IS NULL AND l.purgedAt IS NULL
     ORDER BY p.purchaseDate DESC, l.createdAt DESC LIMIT 1`,
    params,
  );
  return row ?? null;
}

export type PurchaseSummary = Purchase & { supplierName: string; total: number; lineCount: number };

export async function listPurchases(store: Store, opts: { supplierId?: string } & PageParams = {}) {
  const params: SqlValue[] = [];
  let where = "p.deletedAt IS NULL AND p.purgedAt IS NULL";
  if (opts.supplierId) {
    where += " AND p.supplierId = ?";
    params.push(opts.supplierId);
  }
  return store.query<PurchaseSummary>(
    `SELECT p.*, s.name AS supplierName,
       COALESCE((SELECT SUM(ROUND(quantity * unitPrice)) FROM purchaseLines WHERE purchaseId = p.id AND ${ACTIVE}), 0) AS total,
       (SELECT COUNT(*) FROM purchaseLines WHERE purchaseId = p.id AND ${ACTIVE}) AS lineCount
     FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplierId
     WHERE ${where} ORDER BY p.purchaseDate DESC, p.createdAt DESC LIMIT ? OFFSET ?`,
    [...params, opts.limit ?? 50, opts.offset ?? 0],
  );
}

export type PurchaseDetail = {
  purchase: Purchase;
  supplier: Supplier | null;
  lines: (PurchaseLine & { materialName: string; unit: string; total: number })[];
  total: number;
};

export async function getPurchase(store: Store, id: string): Promise<PurchaseDetail | null> {
  const purchase = await store.get("purchases", id);
  if (!purchase) return null;
  const lines = await store.query<PurchaseLine & { materialName: string; unit: string }>(
    `SELECT l.*, m.name AS materialName, m.unit FROM purchaseLines l LEFT JOIN materials m ON m.id = l.materialId
     WHERE l.purchaseId = ? AND l.deletedAt IS NULL AND l.purgedAt IS NULL ORDER BY l.createdAt`,
    [id],
  );
  const withTotals = lines.map((l) => ({ ...l, total: lineTotal(l.quantity, l.unitPrice) }));
  return {
    purchase,
    supplier: await store.get("suppliers", purchase.supplierId),
    lines: withTotals,
    total: withTotals.reduce((s, l) => s + l.total, 0),
  };
}

// ── Jewelry ─────────────────────────────────────────────────────────────

export type Availability = "available" | "in_order";

export type JewelrySummary = {
  id: string;
  code: string | null;
  description: string;
  origin: Jewelry["origin"];
  pieceType: PieceType | null;
  totalCost: number;
  availability: Availability;
  orderId: string | null;
  image: { localUri: string | null; storageKey: string | null } | null;
  createdAt: string;
};

export type JewelryFilter = PageParams & {
  componentType?: JewelryComponent["type"];
  availability?: Availability;
  origin?: Jewelry["origin"];
};

export async function listJewelry(store: Store, f: JewelryFilter = {}): Promise<JewelrySummary[]> {
  const params: SqlValue[] = [];
  let where = "j.deletedAt IS NULL AND j.purgedAt IS NULL";
  if (f.search?.trim()) {
    where += ` AND (j.code LIKE ? ESCAPE '\\' OR j.description LIKE ? ESCAPE '\\')`;
    const q = like(f.search.trim());
    params.push(q, q);
  }
  if (f.componentType) {
    where += ` AND EXISTS (SELECT 1 FROM jewelryComponents c WHERE c.jewelryId = j.id AND c.type = ? AND c.deletedAt IS NULL)`;
    params.push(f.componentType);
  }
  if (f.origin) {
    where += " AND j.origin = ?";
    params.push(f.origin);
  }
  const orderSub = `(SELECT i.jobOrderId FROM jobOrderItems i JOIN jobOrders o ON o.id = i.jobOrderId
     WHERE i.jewelryId = j.id AND i.deletedAt IS NULL AND o.deletedAt IS NULL LIMIT 1)`;
  if (f.availability === "available") where += ` AND ${orderSub} IS NULL`;
  if (f.availability === "in_order") where += ` AND ${orderSub} IS NOT NULL`;

  const rows = await store.query<{
    id: string;
    code: string | null;
    description: string;
    origin: Jewelry["origin"];
    createdAt: string;
    types: string | null;
    totalCost: number | null;
    orderId: string | null;
    localUri: string | null;
    storageKey: string | null;
  }>(
    `SELECT j.id, j.code, j.description, j.origin, j.createdAt,
       (SELECT GROUP_CONCAT(type) FROM jewelryComponents WHERE jewelryId = j.id AND deletedAt IS NULL) AS types,
       ${pieceCostSql("j.id")} AS totalCost,
       ${orderSub} AS orderId,
       im.localUri, im.storageKey
     FROM jewelries j
     LEFT JOIN jewelryImages im ON im.id = (
       SELECT id FROM jewelryImages WHERE jewelryId = j.id AND deletedAt IS NULL
       ORDER BY isPrimary DESC, sortOrder LIMIT 1)
     WHERE ${where}
     ORDER BY j.createdAt DESC LIMIT ? OFFSET ?`,
    [...params, f.limit ?? 30, f.offset ?? 0],
  );

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    description: r.description,
    origin: r.origin,
    createdAt: r.createdAt,
    pieceType: pieceType((r.types?.split(",") ?? []) as JewelryComponent["type"][]),
    totalCost: r.totalCost ?? 0,
    orderId: r.orderId,
    availability: r.orderId ? "in_order" : "available",
    image: r.localUri || r.storageKey ? { localUri: r.localUri, storageKey: r.storageKey } : null,
  }));
}

export type JewelryDetail = {
  jewelry: Jewelry;
  pieceType: PieceType | null;
  components: (JewelryComponent & { stones: JewelryStone[] })[];
  costs: (JewelryCost & { supplierName: string | null; total: number })[];
  /** Sum of all priced stones on the piece. */
  stoneCost: number;
  images: (JewelryImage & { localUri: string | null })[];
  totalCost: number;
  totalWeightG: number | null;
  order: { id: string; code: string | null } | null;
};

export async function getJewelry(store: Store, id: string): Promise<JewelryDetail | null> {
  const jewelry = await store.get("jewelries", id);
  if (!jewelry) return null;
  const components = await store.select("jewelryComponents", `jewelryId = ? AND ${ACTIVE} ORDER BY sortOrder`, [id]);
  const withStones = await Promise.all(
    components.map(async (c) => ({
      ...c,
      stones: await store.select("jewelryStones", `componentId = ? AND ${ACTIVE} ORDER BY createdAt`, [c.id]),
    })),
  );
  const costs = await store.query<JewelryCost & { supplierName: string | null }>(
    `SELECT c.*, s.name AS supplierName FROM jewelryCosts c LEFT JOIN suppliers s ON s.id = c.supplierId
     WHERE c.jewelryId = ? AND c.deletedAt IS NULL AND c.purgedAt IS NULL ORDER BY c.createdAt`,
    [id],
  );
  const images = (await store.select("jewelryImages", `jewelryId = ? AND ${ACTIVE} ORDER BY sortOrder`, [
    id,
  ])) as (JewelryImage & { localUri: string | null })[];
  const [order] = await store.query<{ id: string; code: string | null }>(
    `SELECT o.id, o.code FROM jobOrderItems i JOIN jobOrders o ON o.id = i.jobOrderId
     WHERE i.jewelryId = ? AND i.deletedAt IS NULL AND o.deletedAt IS NULL LIMIT 1`,
    [id],
  );
  const stoneCost = stoneTotal(withStones.flatMap((c) => c.stones));
  return {
    jewelry,
    pieceType: pieceType(components.map((c) => c.type)),
    components: withStones,
    costs: costs.map((c) => ({ ...c, total: lineTotal(c.quantity, c.unitCost) })),
    stoneCost,
    images: images.map((im) => ({ ...im, isPrimary: Boolean(im.isPrimary) })),
    totalCost: costTotal(costs) + stoneCost,
    totalWeightG: totalWeight(jewelry, components),
    order: order ?? null,
  };
}

// ── Job orders ──────────────────────────────────────────────────────────

const ORDER_SELLING = `COALESCE((SELECT SUM(sellingPrice) FROM jobOrderItems WHERE jobOrderId = o.id AND ${ACTIVE}), 0)`;
const ORDER_PAID = `COALESCE((SELECT SUM(amount) FROM payments WHERE jobOrderId = o.id AND ${ACTIVE}), 0)`;

export type OrderMonth = { month: string; orders: number; selling: number; balance: number };

/** Months that have orders, newest first, with totals for browsing by month. */
export async function orderMonths(store: Store): Promise<OrderMonth[]> {
  return store.query<OrderMonth>(
    `SELECT month, COUNT(*) AS orders, SUM(selling) AS selling, SUM(selling - paid) AS balance FROM (
       SELECT substr(o.orderDate, 1, 7) AS month, ${ORDER_SELLING} AS selling, ${ORDER_PAID} AS paid
       FROM jobOrders o WHERE o.deletedAt IS NULL AND o.purgedAt IS NULL)
     GROUP BY month ORDER BY month DESC`,
  );
}

export type OrderSummary = JobOrder & {
  clientName: string;
  itemCount: number;
  selling: number;
  paid: number;
  balance: number;
};

export async function listOrders(
  store: Store,
  f: PageParams & {
    status?: JobOrder["status"];
    clientId?: string;
    /** Orders dated in this month (YYYY-MM). */
    month?: string;
    /** Only orders with a balance still to collect. */
    unpaid?: boolean;
  } = {},
): Promise<OrderSummary[]> {
  const params: SqlValue[] = [];
  let where = "o.deletedAt IS NULL AND o.purgedAt IS NULL";
  if (f.month) {
    where += " AND substr(o.orderDate, 1, 7) = ?";
    params.push(f.month);
  }
  if (f.unpaid) where += ` AND ${ORDER_SELLING} > ${ORDER_PAID}`;
  if (f.status) {
    where += " AND o.status = ?";
    params.push(f.status);
  }
  if (f.clientId) {
    where += " AND o.clientId = ?";
    params.push(f.clientId);
  }
  if (f.search?.trim()) {
    where += ` AND (o.code LIKE ? ESCAPE '\\' OR c.firstName || ' ' || c.lastName LIKE ? ESCAPE '\\')`;
    const q = like(f.search.trim());
    params.push(q, q);
  }
  const rows = await store.query<JobOrder & { clientName: string; itemCount: number; selling: number; paid: number }>(
    `SELECT o.*, c.firstName || ' ' || c.lastName AS clientName,
       (SELECT COUNT(*) FROM jobOrderItems WHERE jobOrderId = o.id AND ${ACTIVE}) AS itemCount,
       ${ORDER_SELLING} AS selling,
       ${ORDER_PAID} AS paid
     FROM jobOrders o LEFT JOIN clients c ON c.id = o.clientId
     WHERE ${where} ORDER BY o.orderDate DESC, o.createdAt DESC LIMIT ? OFFSET ?`,
    [...params, f.limit ?? 30, f.offset ?? 0],
  );
  return rows.map((r) => ({ ...r, balance: r.selling - r.paid }));
}

export type OrderDetail = {
  order: JobOrder;
  client: Client | null;
  items: {
    itemId: string;
    sellingPrice: number;
    cost: number;
    jewelry: JewelrySummary;
  }[];
  payments: Payment[];
  totals: OrderTotals;
};

export async function getOrder(store: Store, id: string): Promise<OrderDetail | null> {
  const order = await store.get("jobOrders", id);
  if (!order) return null;
  const itemRows = await store.select("jobOrderItems", `jobOrderId = ? AND ${ACTIVE} ORDER BY createdAt`, [id]);
  const items = [];
  for (const it of itemRows) {
    const j = await store.get("jewelries", it.jewelryId);
    if (!j) continue;
    const summary = (await summarize(store, j.id)) ?? fallbackSummary(j);
    items.push({ itemId: it.id, sellingPrice: it.sellingPrice, cost: summary.totalCost, jewelry: summary });
  }
  const payments = await store.select("payments", `jobOrderId = ? AND ${ACTIVE} ORDER BY paidAt, createdAt`, [id]);
  return {
    order,
    client: await store.get("clients", order.clientId),
    items,
    payments,
    totals: orderTotals(items, payments),
  };
}

async function summarize(store: Store, jewelryId: string): Promise<JewelrySummary | null> {
  const [row] = await listJewelryById(store, jewelryId);
  return row ?? null;
}

/** Summary for one piece, including deleted ones (history). */
async function listJewelryById(store: Store, id: string): Promise<JewelrySummary[]> {
  const detail = await getJewelry(store, id);
  if (!detail) return [];
  const primary = detail.images.find((i) => i.isPrimary) ?? detail.images[0];
  return [
    {
      id,
      code: detail.jewelry.code,
      description: detail.jewelry.description,
      origin: detail.jewelry.origin,
      createdAt: detail.jewelry.createdAt,
      pieceType: detail.pieceType,
      totalCost: detail.totalCost,
      orderId: detail.order?.id ?? null,
      availability: detail.order ? "in_order" : "available",
      image: primary ? { localUri: primary.localUri, storageKey: primary.storageKey } : null,
    },
  ];
}

function fallbackSummary(j: Jewelry): JewelrySummary {
  return {
    id: j.id,
    code: j.code,
    description: j.description,
    origin: j.origin,
    createdAt: j.createdAt,
    pieceType: null,
    totalCost: 0,
    orderId: null,
    availability: "available",
    image: null,
  };
}

// ── Reports ─────────────────────────────────────────────────────────────

export type MonthSummary = { month: string; orders: number; selling: number; cost: number; profit: number; paid: number };

/** Sales, cost and profit per month (by order date) for one year. */
export async function monthlySummary(store: Store, year: number): Promise<MonthSummary[]> {
  const rows = await store.query<{ month: string; orders: number; selling: number; cost: number; paid: number }>(
    `SELECT substr(o.orderDate, 1, 7) AS month,
       COUNT(DISTINCT o.id) AS orders,
       COALESCE(SUM(i.sellingPrice), 0) AS selling,
       COALESCE(SUM(${pieceCostSql("i.jewelryId")}), 0) AS cost,
       (SELECT COALESCE(SUM(p.amount), 0) FROM payments p JOIN jobOrders o2 ON o2.id = p.jobOrderId
         WHERE substr(o2.orderDate, 1, 7) = substr(o.orderDate, 1, 7)
           AND p.deletedAt IS NULL AND o2.deletedAt IS NULL) AS paid
     FROM jobOrders o
     LEFT JOIN jobOrderItems i ON i.jobOrderId = o.id AND i.deletedAt IS NULL AND i.purgedAt IS NULL
     WHERE o.deletedAt IS NULL AND o.purgedAt IS NULL AND substr(o.orderDate, 1, 4) = ?
     GROUP BY month ORDER BY month`,
    [String(year)],
  );
  return rows.map((r) => ({ ...r, profit: r.selling - r.cost }));
}

// ── Trash ───────────────────────────────────────────────────────────────

export type TrashEntry = { table: TableName; id: string; label: string; deletedAt: string };

const TRASH_LABEL: Partial<Record<TableName, string>> = {
  clients: "firstName || ' ' || lastName",
  suppliers: "name",
  materials: "name",
  purchases: "'Purchase ' || purchaseDate",
  stockAdjustments: "'Stock adjustment ' || date",
  jewelries: "COALESCE(code || ' · ', '') || description",
  jobOrders: "COALESCE(code, 'Job order') || ' · ' || orderDate",
};

export async function listTrash(store: Store): Promise<TrashEntry[]> {
  const parts = TRASHABLE.map(
    (t) =>
      `SELECT '${t}' AS "table", id, ${TRASH_LABEL[t]} AS label, deletedAt FROM ${t}
       WHERE deletedAt IS NOT NULL AND archivedAt IS NULL AND purgedAt IS NULL`,
  );
  return store.query<TrashEntry>(`${parts.join(" UNION ALL ")} ORDER BY deletedAt DESC`);
}
