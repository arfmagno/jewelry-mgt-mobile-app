import { describe, expect, it } from "vitest";
import { getSettings, saveJewelry, saveJobOrder, savePurchase, saveSettings } from "../src/aggregates";
import {
  getOrder,
  latestPrice,
  listClients,
  listJewelry,
  listOrders,
  monthlySummary,
  stockOnHand,
} from "../src/queries";
import { clientInput, ringDraft, testStore } from "./helpers";

describe("clients", () => {
  it("searches by name and phone", async () => {
    const { store } = await testStore();
    await store.insert("clients", clientInput());
    await store.insert("clients", clientInput({ firstName: "Ben", lastName: "Santos", phone: "0998 765 4321" }));
    expect((await listClients(store, { search: "cruz" })).map((c) => c.firstName)).toEqual(["Ana"]);
    expect((await listClients(store, { search: "0998 765" })).map((c) => c.firstName)).toEqual(["Ben"]);
    expect((await listClients(store)).map((c) => c.lastName)).toEqual(["Cruz", "Santos"]);
  });
});

describe("jewelry", () => {
  it("derives type, cost and availability", async () => {
    const { store } = await testStore();
    const id = await saveJewelry(
      store,
      ringDraft({
        components: [
          { ...ringDraft().components[0]!, type: "pendant", stones: [] },
          { ...ringDraft().components[0]!, type: "chain", lengthMm: 457.2, style: "cuban", stones: [] },
        ],
      }),
    );
    const [piece] = await listJewelry(store);
    expect(piece).toMatchObject({ id, pieceType: "necklace", totalCost: 1_330_000, availability: "available" });
    expect(await listJewelry(store, { componentType: "chain" })).toHaveLength(1);
    expect(await listJewelry(store, { componentType: "ring" })).toHaveLength(0);
  });

  it("requires at least one component", async () => {
    const { store } = await testStore();
    await expect(saveJewelry(store, ringDraft({ components: [] }))).rejects.toMatchObject({ code: "no_components" });
  });

  it("removes children dropped from the draft", async () => {
    const { store } = await testStore();
    const id = await saveJewelry(store, ringDraft());
    const detail = (await import("../src/queries")).getJewelry;
    const before = await detail(store, id);
    await saveJewelry(store, {
      ...ringDraft(),
      id,
      components: before!.components.map((c) => ({ ...c, stones: [] })),
      costs: [before!.costs[0]!],
    });
    const after = await detail(store, id);
    expect(after?.components[0]?.stones).toHaveLength(0);
    expect(after?.costs).toHaveLength(1);
    expect(after?.totalCost).toBe(1_280_000);
  });
});

describe("orders", () => {
  it("computes totals and balance with payments", async () => {
    const { store } = await testStore();
    const client = await store.insert("clients", clientInput());
    const pieceId = await saveJewelry(store, ringDraft());
    const orderId = await saveJobOrder(store, {
      clientId: client.id,
      orderDate: "2026-03-05",
      status: "in_production",
      notes: null,
      items: [{ jewelryId: pieceId, sellingPrice: 2_000_000 }],
    });
    await store.insert("payments", {
      jobOrderId: orderId,
      amount: 500_000,
      paidAt: "2026-03-05",
      method: "gcash",
      notes: "Down payment",
    });

    const detail = await getOrder(store, orderId);
    expect(detail?.totals).toMatchObject({ cost: 1_330_000, selling: 2_000_000, profit: 670_000, paid: 500_000, balance: 1_500_000 });

    const [summary] = await listOrders(store, { search: "ana" });
    expect(summary).toMatchObject({ clientName: "Ana Cruz", itemCount: 1, balance: 1_500_000 });

    expect(await monthlySummary(store, 2026)).toEqual([
      { month: "2026-03", orders: 1, selling: 2_000_000, cost: 1_330_000, profit: 670_000, paid: 500_000 },
    ]);
  });

  it("will not put one piece in two orders", async () => {
    const { store } = await testStore();
    const client = await store.insert("clients", clientInput());
    const pieceId = await saveJewelry(store, ringDraft());
    const base = { clientId: client.id, orderDate: "2026-03-05", status: "in_production" as const, notes: null };
    await saveJobOrder(store, { ...base, items: [{ jewelryId: pieceId, sellingPrice: 1 }] });
    await expect(saveJobOrder(store, { ...base, items: [{ jewelryId: pieceId, sellingPrice: 1 }] })).rejects.toMatchObject({
      code: "piece_unavailable",
    });
  });
});

describe("materials", () => {
  it("tracks latest price and stock on hand", async () => {
    const { store } = await testStore();
    const supplier = await store.insert("suppliers", { name: "Gold Co", phone: "(02) 8123 4567", address: null, notes: null });
    const gold = await store.insert("materials", {
      name: "18K yellow gold",
      kind: "metal",
      unit: "g",
      metal: "gold",
      purity: "18K",
      notes: null,
    });
    await savePurchase(store, {
      supplierId: supplier.id,
      purchaseDate: "2026-02-01",
      notes: null,
      lines: [{ materialId: gold.id, quantity: 10, unitPrice: 380_000 }],
    });
    await savePurchase(store, {
      supplierId: supplier.id,
      purchaseDate: "2026-02-15",
      notes: null,
      lines: [{ materialId: gold.id, quantity: 5, unitPrice: 400_000 }],
    });
    expect(await latestPrice(store, gold.id)).toMatchObject({ unitPrice: 400_000, purchaseDate: "2026-02-15" });

    await store.insert("stockAdjustments", { materialId: gold.id, quantity: -0.5, reason: "scrap", date: "2026-02-16", notes: null });
    await saveJewelry(store, ringDraft({ costs: [{ ...ringDraft().costs[0]!, materialId: gold.id }] }));
    expect(await stockOnHand(store, gold.id)).toBeCloseTo(15 - 0.5 - 3.2);
  });
});

describe("settings", () => {
  it("falls back to defaults and saves changes", async () => {
    const { store } = await testStore();
    expect((await getSettings(store)).defaultMarkupPct).toBe(30);
    await saveSettings(store, { lengthUnit: "cm", materialTracking: true });
    expect(await getSettings(store)).toMatchObject({ lengthUnit: "cm", materialTracking: true, currency: "PHP" });
  });
});
