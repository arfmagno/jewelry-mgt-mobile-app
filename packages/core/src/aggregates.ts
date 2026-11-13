import {
  CODE_PREFIXES,
  DEFAULT_SETTINGS,
  formatCode,
  SETTINGS_ID,
  type FieldsInput,
  type Settings,
  type TableName,
} from "@jewelry/shared";
import { activeOrderOf, removeOrderItem, softDelete } from "./lifecycle";
import { DomainError, type Store } from "./store";

/**
 * Aggregate writes: a parent record and its child rows saved atomically.
 * Children absent from the draft are soft-deleted.
 */

type WithId<T> = T & { id?: string };

export type ComponentDraft = WithId<Omit<FieldsInput<"jewelryComponents">, "jewelryId" | "sortOrder">> & {
  stones: WithId<Omit<FieldsInput<"jewelryStones">, "componentId">>[];
};

export type JewelryDraft = WithId<Omit<FieldsInput<"jewelries">, "code">> & {
  components: ComponentDraft[];
  costs: WithId<Omit<FieldsInput<"jewelryCosts">, "jewelryId">>[];
  images: WithId<Omit<FieldsInput<"jewelryImages">, "jewelryId" | "sortOrder"> & { localUri?: string | null }>[];
};

type CodedTable = "jewelries" | "jobOrders";

/**
 * Next human-readable code (JW-00001, JO-00001) for a new record, numbered on
 * the device so pieces and orders are named even when offline. The server keeps
 * these codes and moves its own counter past them.
 */
export async function nextCode(store: Store, table: CodedTable): Promise<string> {
  const prefix = CODE_PREFIXES[table]!;
  const [row] = await store.query<{ n: number | null }>(
    `SELECT MAX(CAST(substr(code, ${prefix.length + 2}) AS INTEGER)) AS n FROM ${table} WHERE code LIKE ?`,
    [`${prefix}-%`],
  );
  return formatCode(prefix, (row?.n ?? 0) + 1);
}

/** Gives a code to records created before codes were numbered on the device, oldest first. */
export async function assignMissingCodes(store: Store): Promise<number> {
  let assigned = 0;
  for (const table of ["jewelries", "jobOrders"] as const) {
    const rows = await store.query<{ id: string }>(
      `SELECT id FROM ${table} WHERE code IS NULL AND purgedAt IS NULL ORDER BY createdAt`,
    );
    for (const { id } of rows) {
      await store.update(table, id, { code: await nextCode(store, table) });
      assigned++;
    }
  }
  return assigned;
}

async function syncChildren<T extends TableName>(
  store: Store,
  table: T,
  parentColumn: string,
  parentId: string,
  keep: string[],
) {
  const existing = await store.query<{ id: string }>(
    `SELECT id FROM ${table} WHERE ${parentColumn} = ? AND deletedAt IS NULL AND purgedAt IS NULL`,
    [parentId],
  );
  for (const { id } of existing) {
    if (!keep.includes(id)) await softDelete(store, table, id);
  }
}

export async function saveJewelry(store: Store, draft: JewelryDraft): Promise<string> {
  if (draft.components.length === 0) {
    throw new DomainError("no_components", "Add at least one part (ring, chain, pendant…).");
  }
  return store.transaction(async () => {
    const { components, costs, images, id, ...fields } = draft;
    const existing = id ? await store.get("jewelries", id) : null;
    const piece = await store.upsert("jewelries", id, { ...fields, code: existing?.code ?? (await nextCode(store, "jewelries")) });

    const componentIds: string[] = [];
    for (const [i, c] of components.entries()) {
      const { stones, id: cid, ...cf } = c;
      const comp = await store.upsert("jewelryComponents", cid, { ...cf, jewelryId: piece.id, sortOrder: i });
      componentIds.push(comp.id);
      const stoneIds: string[] = [];
      for (const s of stones) {
        const { id: sid, ...sf } = s;
        stoneIds.push((await store.upsert("jewelryStones", sid, { ...sf, componentId: comp.id })).id);
      }
      await syncChildren(store, "jewelryStones", "componentId", comp.id, stoneIds);
    }
    await syncChildren(store, "jewelryComponents", "jewelryId", piece.id, componentIds);

    const costIds: string[] = [];
    for (const c of costs) {
      const { id: cid, ...cf } = c;
      costIds.push((await store.upsert("jewelryCosts", cid, { ...cf, jewelryId: piece.id })).id);
    }
    await syncChildren(store, "jewelryCosts", "jewelryId", piece.id, costIds);

    const imageIds: string[] = [];
    const hasPrimary = images.some((im) => im.isPrimary);
    for (const [i, im] of images.entries()) {
      const { id: iid, localUri, ...imf } = im;
      const saved = await store.upsert("jewelryImages", iid, {
        ...imf,
        isPrimary: hasPrimary ? imf.isPrimary : i === 0,
        jewelryId: piece.id,
        sortOrder: i,
      });
      if (localUri !== undefined) await store.setLocal("jewelryImages", saved.id, "localUri", localUri);
      imageIds.push(saved.id);
    }
    await syncChildren(store, "jewelryImages", "jewelryId", piece.id, imageIds);
    return piece.id;
  });
}

export type PurchaseDraft = WithId<FieldsInput<"purchases">> & {
  lines: WithId<Omit<FieldsInput<"purchaseLines">, "purchaseId">>[];
};

export async function savePurchase(store: Store, draft: PurchaseDraft): Promise<string> {
  if (draft.lines.length === 0) throw new DomainError("no_lines", "Add at least one item.");
  return store.transaction(async () => {
    const { lines, id, ...fields } = draft;
    const purchase = await store.upsert("purchases", id, fields);
    const ids: string[] = [];
    for (const l of lines) {
      const { id: lid, ...lf } = l;
      ids.push((await store.upsert("purchaseLines", lid, { ...lf, purchaseId: purchase.id })).id);
    }
    await syncChildren(store, "purchaseLines", "purchaseId", purchase.id, ids);
    return purchase.id;
  });
}

export type OrderDraft = WithId<Omit<FieldsInput<"jobOrders">, "code">> & {
  items: WithId<Omit<FieldsInput<"jobOrderItems">, "jobOrderId">>[];
};

export async function saveJobOrder(store: Store, draft: OrderDraft): Promise<string> {
  if (draft.items.length === 0) throw new DomainError("no_items", "Add at least one piece.");
  return store.transaction(async () => {
    const { items, id, ...fields } = draft;
    const existing = id ? await store.get("jobOrders", id) : null;
    const order = await store.upsert("jobOrders", id, { ...fields, code: existing?.code ?? (await nextCode(store, "jobOrders")) });

    const keep: string[] = [];
    for (const item of items) {
      const { id: iid, ...itf } = item;
      const owner = await activeOrderOf(store, itf.jewelryId);
      if (owner && owner !== order.id) {
        throw new DomainError("piece_unavailable", "A selected piece already belongs to another order.");
      }
      const current = iid ? await store.get("jobOrderItems", iid) : null;
      const match =
        current ??
        (await store.select("jobOrderItems", "jobOrderId = ? AND jewelryId = ? AND deletedAt IS NULL", [
          order.id,
          itf.jewelryId,
        ]))[0];
      const saved = await store.upsert("jobOrderItems", match?.id, { ...itf, jobOrderId: order.id });
      keep.push(saved.id);
    }
    const removed = await store.query<{ id: string }>(
      "SELECT id FROM jobOrderItems WHERE jobOrderId = ? AND deletedAt IS NULL AND purgedAt IS NULL",
      [order.id],
    );
    for (const r of removed) if (!keep.includes(r.id)) await removeOrderItem(store, r.id);
    return order.id;
  });
}

export async function getSettings(store: Store): Promise<Settings> {
  const s = await store.get("settings", SETTINGS_ID);
  if (s) return s;
  const now = new Date(0).toISOString();
  return {
    id: SETTINGS_ID,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    archivedAt: null,
    purgedAt: null,
    ...DEFAULT_SETTINGS,
  };
}

export async function saveSettings(store: Store, patch: Partial<FieldsInput<"settings">>): Promise<Settings> {
  const current = await getSettings(store);
  const { id: _i, createdAt: _c, updatedAt: _u, deletedAt: _d, archivedAt: _a, purgedAt: _p, ...fields } = current;
  return store.upsert("settings", SETTINGS_ID, { ...fields, ...patch });
}
