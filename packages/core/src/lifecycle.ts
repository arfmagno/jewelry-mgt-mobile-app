import { RELATIONS, TABLES, TRASH_RETENTION_DAYS, type TableName } from "@jewelry/shared";
import { DomainError, type Store } from "./store";

/**
 * Record lifecycle:  active → deleted (Trash, restorable) → after the retention window:
 *   - purged   when nothing references it (a tombstone syncs the removal), or
 *   - archived when something still references it (hidden, kept for history).
 * Children marked `cascade` follow their parent through every step.
 */

const DAY_MS = 86_400_000;

const cascadeChildren = (table: TableName) => RELATIONS.filter((r) => r.parent === table && r.cascade);

/** Entities that appear in Trash (children are restored together with their parent). */
export const TRASHABLE: readonly TableName[] = [
  "clients",
  "suppliers",
  "materials",
  "purchases",
  "stockAdjustments",
  "jewelries",
  "jobOrders",
];

async function cascade(
  store: Store,
  table: TableName,
  id: string,
  patch: { deletedAt: string | null },
  match: { deletedAt: string | null },
) {
  await store.setLifecycle(table, id, patch);
  for (const rel of cascadeChildren(table)) {
    const where =
      match.deletedAt === null
        ? `${rel.column} = ? AND deletedAt IS NULL AND purgedAt IS NULL`
        : `${rel.column} = ? AND deletedAt = ? AND purgedAt IS NULL`;
    const params = match.deletedAt === null ? [id] : [id, match.deletedAt];
    const children = await store.query<{ id: string }>(`SELECT id FROM ${rel.table} WHERE ${where}`, params);
    for (const c of children) await cascade(store, rel.table, c.id, patch, match);
  }
}

/** Active (not deleted) job order item referencing this piece, if any. */
export async function activeOrderOf(store: Store, jewelryId: string): Promise<string | null> {
  const row = await store.db.first<{ jobOrderId: string }>(
    `SELECT i.jobOrderId FROM jobOrderItems i JOIN jobOrders o ON o.id = i.jobOrderId
     WHERE i.jewelryId = ? AND i.deletedAt IS NULL AND i.purgedAt IS NULL
       AND o.deletedAt IS NULL AND o.purgedAt IS NULL`,
    [jewelryId],
  );
  return row?.jobOrderId ?? null;
}

/** Soft-deletes a record and its cascade children. */
export async function softDelete(store: Store, table: TableName, id: string): Promise<void> {
  await store.transaction(async () => {
    const rec = await store.require(table, id);
    if (rec.deletedAt) return;
    if (table === "jewelries" && (await activeOrderOf(store, id))) {
      throw new DomainError("in_active_order", "This piece is part of a job order. Remove it from the order first.");
    }
    await cascade(store, table, id, { deletedAt: store.now() }, { deletedAt: null });
  });
}

/** Restores a record from Trash together with the children deleted alongside it. */
export async function restore(store: Store, table: TableName, id: string): Promise<void> {
  await store.transaction(async () => {
    const rec = await store.require(table, id);
    if (!rec.deletedAt) return;
    if (rec.archivedAt) throw new DomainError("archived", "This record can no longer be restored.");
    if (table === "jobOrders") {
      const items = await store.query<{ jewelryId: string }>(
        "SELECT jewelryId FROM jobOrderItems WHERE jobOrderId = ? AND deletedAt = ?",
        [id, rec.deletedAt],
      );
      for (const item of items) {
        if (await activeOrderOf(store, item.jewelryId)) {
          throw new DomainError("piece_reassigned", "A piece from this order now belongs to another order.");
        }
      }
    }
    await cascade(store, table, id, { deletedAt: null }, { deletedAt: rec.deletedAt });
    if (table === "jobOrders") {
      // Made-to-order pieces deleted together with the order come back with it.
      const pieces = await store.query<{ id: string }>(
        `SELECT j.id FROM jobOrderItems i JOIN jewelries j ON j.id = i.jewelryId
         WHERE i.jobOrderId = ? AND i.deletedAt IS NULL AND j.origin = 'made_to_order'
           AND j.deletedAt IS NOT NULL AND j.archivedAt IS NULL AND j.purgedAt IS NULL`,
        [id],
      );
      for (const p of pieces) await restore(store, "jewelries", p.id);
    }
  });
}

/**
 * Deletes a job order. Its items and payments go with it, on-hand pieces become
 * available again, and made-to-order pieces are deleted too when requested.
 */
export async function deleteJobOrder(
  store: Store,
  orderId: string,
  opts: { deleteMadeToOrderPieces: boolean },
): Promise<void> {
  await store.transaction(async () => {
    const pieces = await store.query<{ id: string; origin: string }>(
      `SELECT j.id, j.origin FROM jobOrderItems i JOIN jewelries j ON j.id = i.jewelryId
       WHERE i.jobOrderId = ? AND i.deletedAt IS NULL AND j.deletedAt IS NULL`,
      [orderId],
    );
    await softDelete(store, "jobOrders", orderId);
    if (opts.deleteMadeToOrderPieces) {
      for (const p of pieces) {
        if (p.origin === "made_to_order") await softDelete(store, "jewelries", p.id);
      }
    }
  });
}

/** Removes a piece from an order: made-to-order pieces are deleted, on-hand pieces return to stock. */
export async function removeOrderItem(store: Store, itemId: string): Promise<void> {
  await store.transaction(async () => {
    const item = await store.require("jobOrderItems", itemId);
    await softDelete(store, "jobOrderItems", itemId);
    const piece = await store.get("jewelries", item.jewelryId);
    if (piece && piece.origin === "made_to_order" && !piece.deletedAt) {
      await softDelete(store, "jewelries", piece.id);
    }
  });
}

export type PurgeReport = { purged: number; archived: number };

/** Finalizes records that have been in Trash longer than the retention window. */
export async function purgeExpired(store: Store, retentionDays = TRASH_RETENTION_DAYS): Promise<PurgeReport> {
  const cutoff = new Date(Date.parse(store.now()) - retentionDays * DAY_MS).toISOString();
  const report: PurgeReport = { purged: 0, archived: 0 };

  await store.transaction(async () => {
    // Children first, so parents whose children were purged become unreferenced.
    for (const table of [...TABLES].reverse()) {
      const expired = await store.query<{ id: string }>(
        `SELECT id FROM ${table} WHERE deletedAt IS NOT NULL AND deletedAt <= ? AND archivedAt IS NULL AND purgedAt IS NULL`,
        [cutoff],
      );
      for (const { id } of expired) {
        const now = store.now();
        if (await isReferenced(store, table, id)) {
          await store.setLifecycle(table, id, { archivedAt: now });
          report.archived++;
        } else {
          await store.setLifecycle(table, id, { purgedAt: now });
          report.purged++;
        }
      }
    }
  });
  return report;
}

async function isReferenced(store: Store, table: TableName, id: string): Promise<boolean> {
  for (const rel of RELATIONS.filter((r) => r.parent === table)) {
    const row = await store.db.first(
      `SELECT 1 FROM ${rel.table} WHERE ${rel.column} = ? AND purgedAt IS NULL LIMIT 1`,
      [id],
    );
    if (row) return true;
  }
  return false;
}
