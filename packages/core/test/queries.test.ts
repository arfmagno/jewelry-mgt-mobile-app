import { describe, expect, it } from "vitest";
import { assignMissingCodes, getSettings, saveJewelry, saveJobOrder, savePurchase, saveSettings } from "../src/aggregates";
import {
  getJewelry,
  getOrder,
  latestPrice,
  listClients,
  listClientSummaries,
  listJewelry,
  listOrders,
  monthlySummary,
  orderCounts,
  orderMonths,
  orderYears,
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

  it("counts each client's orders and what they still owe", async () => {
    const { store } = await testStore();
    const ana = (await store.insert("clients", clientInput())).id;
    await store.insert("clients", clientInput({ firstName: "Ben", lastName: "Santos", phone: "0998 765 4321" }));
    for (const [price, paid] of [[100_000, 100_000], [200_000, 50_000]] as const) {
      const jewelryId = await saveJewelry(store, ringDraft());
      const order = await saveJobOrder(store, { clientId: ana, orderDate: "2026-03-01", status: "in_production", notes: null, items: [{ jewelryId, sellingPrice: price }] });
      await store.insert("payments", { jobOrderId: order, amount: paid, paidAt: "2026-03-01", method: "cash", notes: null });
    }
    expect((await listClientSummaries(store)).map((c) => [c.firstName, c.orders, c.balance])).toEqual([
      ["Ana", 2, 150_000],
      ["Ben", 0, 0],
    ]);
  });
});

describe("jewelry", () => {
  it("numbers new pieces and orders on the device", async () => {
    const { store } = await testStore();
    const first = await saveJewelry(store, ringDraft());
    const second = await saveJewelry(store, ringDraft());
    expect((await store.get("jewelries", first))?.code).toBe("JW-00001");
    expect((await store.get("jewelries", second))?.code).toBe("JW-00002");
    // Editing keeps the code.
    await saveJewelry(store, { ...ringDraft(), id: first });
    expect((await store.get("jewelries", first))?.code).toBe("JW-00001");

    const clientId = (await store.insert("clients", clientInput())).id;
    const orderId = await saveJobOrder(store, { clientId, orderDate: "2026-04-01", status: "in_production", notes: null, items: [{ jewelryId: first, sellingPrice: 1 }] });
    expect((await store.get("jobOrders", orderId))?.code).toBe("JO-00001");
  });

  it("gives older records without a code the next numbers, oldest first", async () => {
    const { store } = await testStore();
    const a = await saveJewelry(store, ringDraft());
    const b = await saveJewelry(store, ringDraft());
    await store.db.run("UPDATE jewelries SET code = NULL WHERE id = ?", [b]);
    expect(await assignMissingCodes(store)).toBe(1);
    expect((await store.get("jewelries", a))?.code).toBe("JW-00001");
    expect((await store.get("jewelries", b))?.code).toBe("JW-00002");
  });

  it("adds priced stones to the piece cost everywhere it is shown", async () => {
    const { store } = await testStore();
    const base = ringDraft();
    const stone = { ...base.components[0]!.stones[0]!, quantity: 3, unitCost: 150_000 };
    const pieceId = await saveJewelry(store, ringDraft({ components: [{ ...base.components[0]!, stones: [stone] }] }));

    const [summary] = await listJewelry(store);
    expect(summary!.totalCost).toBe(1_330_000 + 450_000);
    const detail = await getJewelry(store, pieceId);
    expect(detail).toMatchObject({ stoneCost: 450_000, totalCost: 1_780_000 });

    const clientId = (await store.insert("clients", clientInput())).id;
    await saveJobOrder(store, {
      clientId,
      orderDate: "2026-04-01",
      status: "in_production",
      notes: null,
      items: [{ jewelryId: pieceId, sellingPrice: 2_500_000 }],
    });
    const [month] = await monthlySummary(store, 2026);
    expect(month).toMatchObject({ cost: 1_780_000, profit: 720_000 });
  });

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

describe("browsing orders", () => {
  it("filters by month and unpaid balance and summarises each month", async () => {
    const { store } = await testStore();
    const clientId = (await store.insert("clients", clientInput())).id;
    const order = async (date: string, price: number, paid: number) => {
      const pieceId = await saveJewelry(store, ringDraft());
      const id = await saveJobOrder(store, { clientId, orderDate: date, status: "in_production", notes: null, items: [{ jewelryId: pieceId, sellingPrice: price }] });
      if (paid) await store.insert("payments", { jobOrderId: id, amount: paid, paidAt: date, method: "cash", notes: null });
      return id;
    };
    const marchPaid = await order("2026-03-02", 100_000, 100_000);
    const marchOwing = await order("2026-03-20", 200_000, 50_000);
    const april = await order("2026-04-01", 300_000, 0);

    expect((await listOrders(store, { month: "2026-03" })).map((o) => o.id)).toEqual([marchOwing, marchPaid]);
    expect((await listOrders(store, { unpaid: true })).map((o) => o.id)).toEqual([april, marchOwing]);
    expect(await orderMonths(store)).toEqual([
      { month: "2026-04", orders: 1, selling: 300_000, balance: 300_000 },
      { month: "2026-03", orders: 2, selling: 300_000, balance: 150_000 },
    ]);

    await store.update("jobOrders", marchPaid, { status: "completed" });
    expect(await orderCounts(store)).toEqual({ in_production: 2, completed: 1 });
    expect(await orderMonths(store, { status: "completed" })).toEqual([{ month: "2026-03", orders: 1, selling: 100_000, balance: 0 }]);
  });

  it("filters by year and summarises each year", async () => {
    const { store } = await testStore();
    const clientId = (await store.insert("clients", clientInput())).id;
    const order = async (date: string, price: number) => {
      const pieceId = await saveJewelry(store, ringDraft());
      return saveJobOrder(store, { clientId, orderDate: date, status: "completed", notes: null, items: [{ jewelryId: pieceId, sellingPrice: price }] });
    };
    const late = await order("2025-12-30", 100_000);
    const early = await order("2026-01-02", 200_000);
    const spring = await order("2026-04-10", 300_000);

    expect((await listOrders(store, { year: "2026" })).map((o) => o.id)).toEqual([spring, early]);
    expect((await listOrders(store, { year: "2025" })).map((o) => o.id)).toEqual([late]);
    expect(await orderYears(store, { status: "completed" })).toEqual([
      { year: "2026", orders: 2, selling: 500_000, balance: 500_000 },
      { year: "2025", orders: 1, selling: 100_000, balance: 100_000 },
    ]);
  });
});
