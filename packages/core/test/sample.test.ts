import { describe, expect, it } from "vitest";
import { clearSampleData, hasSampleData, seedSampleData } from "../src/sample";
import { listJewelry, listOrders, orderCounts, orderMonths } from "../src/queries";
import { testStore } from "./helpers";

const today = new Date(2026, 10, 13);

describe("sample data", () => {
  it("loads pieces and orders spread over many months", async () => {
    const { store } = await testStore();
    const counts = await seedSampleData(store, { today, pieces: 60 });
    expect(counts.pieces).toBe(60);
    expect(counts.orders).toBeGreaterThan(20);
    expect(await hasSampleData(store)).toBe(true);

    const available = await listJewelry(store, { availability: "available", limit: 500 });
    expect(available.length).toBeGreaterThan(0);
    expect(available.every((j) => j.code?.startsWith("JW-"))).toBe(true);

    const status = await orderCounts(store);
    expect(status.completed).toBeGreaterThan(0);
    expect(status.in_production).toBeGreaterThan(0);
    expect((await orderMonths(store, { status: "completed" })).length).toBeGreaterThan(6);
    expect((await listOrders(store, { unpaid: true })).length).toBeGreaterThan(0);
  });

  it("loads the same set again without duplicating it", async () => {
    const { store } = await testStore();
    const first = await seedSampleData(store, { today, pieces: 30 });
    const again = await seedSampleData(store, { today, pieces: 30 });
    expect(again).toEqual(first);
    expect(await listJewelry(store, { limit: 500 })).toHaveLength(30);
  });

  it("removes the set and what hangs off it, leaving other records and no sync queue", async () => {
    const { store } = await testStore();
    const mine = await store.insert("clients", { firstName: "Real", lastName: "Client", phone: "09171234567", address: null, notes: null });
    await seedSampleData(store, { today, pieces: 30 });
    await clearSampleData(store);

    expect(await hasSampleData(store)).toBe(false);
    expect(await listJewelry(store, { limit: 500 })).toHaveLength(0);
    expect(await listOrders(store, {})).toHaveLength(0);
    expect(await store.get("clients", mine.id)).not.toBeNull();
    for (const t of ["jewelryComponents", "jewelryStones", "jewelryCosts", "jobOrderItems", "payments", "purchaseLines"]) {
      const [row] = await store.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`);
      expect(row!.n, t).toBe(0);
    }
    expect(await store.pendingCount()).toBe(1);
  });
});
