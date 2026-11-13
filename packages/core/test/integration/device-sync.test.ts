import { call, event, startDynamo, testHandler } from "@jewelry/backend/testing";
import type { PullResponse, PushResponse } from "@jewelry/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { saveJewelry, saveJobOrder } from "../../src/aggregates";
import { deleteJobOrder } from "../../src/lifecycle";
import { getOrder, listJewelry } from "../../src/queries";
import { SyncEngine, type SyncTransport } from "../../src/sync";
import { clientInput, ringDraft, testClock, testStore } from "../helpers";

/**
 * Two devices, each with its own SQLite database, syncing through the real
 * Lambda handler backed by an in-process DynamoDB.
 */
describe("device ↔ backend sync (integration)", () => {
  let dynamo: Awaited<ReturnType<typeof startDynamo>>;

  beforeAll(async () => {
    dynamo = await startDynamo("device-sync");
  });
  afterAll(() => dynamo.stop());

  function transportFor(handler: ReturnType<typeof testHandler>["handler"], user: string): SyncTransport {
    return {
      async push(body) {
        const res = await call<PushResponse>(handler, event("POST", "/sync/push", { body, user }));
        if (res.status !== 200) throw new Error(`push failed: ${JSON.stringify(res.body)}`);
        return res.body;
      },
      async pull(q) {
        const query = Object.fromEntries(
          Object.entries(q).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
        );
        const res = await call<PullResponse>(handler, event("GET", "/sync/pull", { query, user }));
        if (res.status !== 200) throw new Error(`pull failed: ${JSON.stringify(res.body)}`);
        return res.body;
      },
    };
  }

  it("converges a full order workflow across two devices", async () => {
    const clock = testClock();
    const { handler } = testHandler({ repo: dynamo.repo, now: () => clock.now() });
    const phone = await testStore(clock);
    const tablet = await testStore(clock);
    const syncPhone = new SyncEngine(phone.store, transportFor(handler, "owner"));
    const syncTablet = new SyncEngine(tablet.store, transportFor(handler, "owner"));

    // Phone records a client, a made-to-order piece and an order with a down payment — offline.
    const client = await phone.store.insert("clients", clientInput());
    const pieceId = await saveJewelry(phone.store, ringDraft({ origin: "made_to_order" }));
    const orderId = await saveJobOrder(phone.store, {
      clientId: client.id,
      orderDate: "2026-03-01",
      status: "in_production",
      notes: null,
      items: [{ jewelryId: pieceId, sellingPrice: 2_000_000 }],
    });
    await phone.store.insert("payments", {
      jobOrderId: orderId,
      amount: 500_000,
      paidAt: "2026-03-01",
      method: "cash",
      notes: null,
    });
    // Numbered on the phone before any sync; the server keeps the code.
    expect((await phone.store.get("jobOrders", orderId))?.code).toBe("JO-00001");

    clock.advance(1000);
    await syncPhone.sync();
    expect((await phone.store.get("jobOrders", orderId))?.code).toBe("JO-00001");
    expect((await phone.store.get("jewelries", pieceId))?.code).toBe("JW-00001");

    clock.advance(1000);
    await syncTablet.sync();
    const onTablet = await getOrder(tablet.store, orderId);
    expect(onTablet?.order.code).toBe("JO-00001");
    expect(onTablet?.client?.firstName).toBe("Ana");
    expect(onTablet?.totals).toMatchObject({ selling: 2_000_000, paid: 500_000, balance: 1_500_000, cost: 1_330_000 });

    // Tablet marks it completed; phone deletes nothing yet and picks the change up.
    clock.advance(1000);
    await tablet.store.update("jobOrders", orderId, { status: "completed" });
    await syncTablet.sync();
    clock.advance(1000);
    await syncPhone.sync();
    expect((await phone.store.get("jobOrders", orderId))?.status).toBe("completed");

    // Phone deletes the order (and its made-to-order piece); the tablet follows.
    clock.advance(1000);
    await deleteJobOrder(phone.store, orderId, { deleteMadeToOrderPieces: true });
    await syncPhone.sync();
    clock.advance(1000);
    await syncTablet.sync();
    expect((await tablet.store.get("jobOrders", orderId))?.deletedAt).not.toBeNull();
    expect(await listJewelry(tablet.store)).toHaveLength(0);

    // After the retention window the purge propagates as tombstones.
    clock.advanceDays(8);
    const report = await syncPhone.sync();
    expect(report.purged).toBeGreaterThan(0);
    clock.advance(1000);
    await syncTablet.sync();
    expect(await tablet.store.query("SELECT id FROM jewelries")).toHaveLength(0);
    expect(await tablet.store.query("SELECT id FROM jobOrders")).toHaveLength(0);
    // The client is untouched.
    expect((await tablet.store.get("clients", client.id))?.deletedAt).toBeNull();
  });
});
