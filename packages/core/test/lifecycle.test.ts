import { describe, expect, it } from "vitest";
import { saveJewelry, saveJobOrder } from "../src/aggregates";
import { deleteJobOrder, purgeExpired, removeOrderItem, restore, softDelete } from "../src/lifecycle";
import { getJewelry, listJewelry, listTrash } from "../src/queries";
import type { Store } from "../src/store";
import { clientInput, ringDraft, testStore } from "./helpers";

async function orderWith(store: Store, origin: "on_hand" | "made_to_order") {
  const client = await store.insert("clients", clientInput());
  const pieceId = await saveJewelry(store, ringDraft({ origin }));
  const orderId = await saveJobOrder(store, {
    clientId: client.id,
    orderDate: "2026-03-01",
    status: "in_production",
    notes: null,
    items: [{ jewelryId: pieceId, sellingPrice: 2_000_000 }],
  });
  return { client, pieceId, orderId };
}

describe("soft delete & restore", () => {
  it("cascades to children and restores them together", async () => {
    const { store } = await testStore();
    const id = await saveJewelry(store, ringDraft());
    await softDelete(store, "jewelries", id);

    const active = await store.query("SELECT id FROM jewelryComponents WHERE deletedAt IS NULL");
    expect(active).toHaveLength(0);
    expect(await store.query("SELECT id FROM jewelryStones WHERE deletedAt IS NULL")).toHaveLength(0);
    expect((await listTrash(store)).map((t) => t.id)).toEqual([id]);

    await restore(store, "jewelries", id);
    const detail = await getJewelry(store, id);
    expect(detail?.components).toHaveLength(1);
    expect(detail?.components[0]?.stones).toHaveLength(1);
    expect(detail?.costs).toHaveLength(2);
  });

  it("does not restore children that were deleted separately earlier", async () => {
    const { store, clock } = await testStore();
    const id = await saveJewelry(store, ringDraft());
    const [cost] = await store.query<{ id: string }>("SELECT id FROM jewelryCosts LIMIT 1");
    await softDelete(store, "jewelryCosts", cost!.id);
    clock.advance(5000);
    await softDelete(store, "jewelries", id);
    await restore(store, "jewelries", id);
    expect((await getJewelry(store, id))?.costs).toHaveLength(1);
  });

  it("blocks deleting a piece that is in an active order", async () => {
    const { store } = await testStore();
    const { pieceId } = await orderWith(store, "on_hand");
    await expect(softDelete(store, "jewelries", pieceId)).rejects.toMatchObject({ code: "in_active_order" });
  });

  it("keeps a deleted client's orders intact", async () => {
    const { store } = await testStore();
    const { client, orderId } = await orderWith(store, "on_hand");
    await softDelete(store, "clients", client.id);
    const order = await store.get("jobOrders", orderId);
    expect(order?.deletedAt).toBeNull();
    expect((await store.get("clients", client.id))?.deletedAt).not.toBeNull();
  });
});

describe("job order deletion", () => {
  it("frees on-hand pieces", async () => {
    const { store } = await testStore();
    const { pieceId, orderId } = await orderWith(store, "on_hand");
    await deleteJobOrder(store, orderId, { deleteMadeToOrderPieces: true });
    const [piece] = await listJewelry(store);
    expect(piece).toMatchObject({ id: pieceId, availability: "available" });
  });

  it("deletes made-to-order pieces when asked, and restores them with the order", async () => {
    const { store } = await testStore();
    const { pieceId, orderId } = await orderWith(store, "made_to_order");
    await deleteJobOrder(store, orderId, { deleteMadeToOrderPieces: true });
    expect((await store.get("jewelries", pieceId))?.deletedAt).not.toBeNull();

    await restore(store, "jobOrders", orderId);
    expect((await store.get("jewelries", pieceId))?.deletedAt).toBeNull();
    expect((await listJewelry(store))[0]).toMatchObject({ id: pieceId, availability: "in_order" });
  });

  it("keeps made-to-order pieces when declined", async () => {
    const { store } = await testStore();
    const { pieceId, orderId } = await orderWith(store, "made_to_order");
    await deleteJobOrder(store, orderId, { deleteMadeToOrderPieces: false });
    expect((await store.get("jewelries", pieceId))?.deletedAt).toBeNull();
  });

  it("refuses to restore an order whose piece was sold again", async () => {
    const { store } = await testStore();
    const { client, pieceId, orderId } = await orderWith(store, "on_hand");
    await deleteJobOrder(store, orderId, { deleteMadeToOrderPieces: false });
    await saveJobOrder(store, {
      clientId: client.id,
      orderDate: "2026-03-02",
      status: "in_production",
      notes: null,
      items: [{ jewelryId: pieceId, sellingPrice: 1 }],
    });
    await expect(restore(store, "jobOrders", orderId)).rejects.toMatchObject({ code: "piece_reassigned" });
  });

  it("removing an item deletes made-to-order pieces and frees on-hand ones", async () => {
    const { store } = await testStore();
    const mto = await orderWith(store, "made_to_order");
    const [item] = await store.query<{ id: string }>("SELECT id FROM jobOrderItems WHERE jobOrderId = ?", [
      mto.orderId,
    ]);
    await removeOrderItem(store, item!.id);
    expect((await store.get("jewelries", mto.pieceId))?.deletedAt).not.toBeNull();

    const onHand = await orderWith(store, "on_hand");
    const [item2] = await store.query<{ id: string }>("SELECT id FROM jobOrderItems WHERE jobOrderId = ?", [
      onHand.orderId,
    ]);
    await removeOrderItem(store, item2!.id);
    expect((await store.get("jewelries", onHand.pieceId))?.deletedAt).toBeNull();
  });
});

describe("purgeExpired", () => {
  it("leaves recent trash alone", async () => {
    const { store, clock } = await testStore();
    const c = await store.insert("clients", clientInput());
    await softDelete(store, "clients", c.id);
    clock.advanceDays(6);
    expect(await purgeExpired(store)).toEqual({ purged: 0, archived: 0 });
  });

  it("purges unreferenced records and their children after 7 days", async () => {
    const { store, clock } = await testStore();
    const id = await saveJewelry(store, ringDraft());
    await softDelete(store, "jewelries", id);
    clock.advanceDays(8);
    const report = await purgeExpired(store);
    expect(report.archived).toBe(0);
    expect(report.purged).toBe(5); // piece, component, stone, two costs
    expect(await store.get("jewelries", id)).toBeNull();
    expect(await listTrash(store)).toHaveLength(0);
  });

  it("archives referenced records so history keeps working", async () => {
    const { store, clock } = await testStore();
    const { client, orderId } = await orderWith(store, "on_hand");
    await softDelete(store, "clients", client.id);
    clock.advanceDays(8);
    expect(await purgeExpired(store)).toEqual({ purged: 0, archived: 1 });
    expect((await store.get("clients", client.id))?.archivedAt).not.toBeNull();
    expect(await listTrash(store)).toHaveLength(0);
    await expect(restore(store, "clients", client.id)).rejects.toMatchObject({ code: "archived" });
    expect((await store.get("jobOrders", orderId))?.clientId).toBe(client.id);
  });
});
