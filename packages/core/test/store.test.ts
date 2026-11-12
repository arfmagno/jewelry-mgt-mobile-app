import { fieldNames, metaSchema, TABLES } from "@jewelry/shared";
import { describe, expect, it, vi } from "vitest";
import { LOCAL_ONLY_COLUMNS } from "../src/schema";
import { clientInput, memoryDb, testStore } from "./helpers";
import { migrate } from "../src/schema";

describe("local schema", () => {
  it("has exactly the columns defined by the shared record schemas", async () => {
    const db = await memoryDb();
    await migrate(db);
    for (const table of TABLES) {
      const cols = (await db.all<{ name: string }>(`PRAGMA table_info(${table})`)).map((c) => c.name).sort();
      const expected = [
        ...Object.keys(metaSchema.shape),
        ...fieldNames(table),
        ...(LOCAL_ONLY_COLUMNS[table] ?? []),
      ].sort();
      expect(cols, table).toEqual(expected);
    }
  });

  it("is idempotent", async () => {
    const db = await memoryDb();
    await migrate(db);
    await migrate(db);
    expect((await db.first<{ user_version: number }>("PRAGMA user_version"))?.user_version).toBe(1);
  });
});

describe("Store", () => {
  it("validates, timestamps and queues inserts", async () => {
    const { store } = await testStore();
    const c = await store.insert("clients", clientInput());
    expect(c.phone).toBe("+639171234567");
    expect(c.createdAt).toBe("2026-03-01T08:00:00.000Z");
    expect(await store.pendingCount()).toBe(1);
    expect(await store.get("clients", c.id)).toMatchObject({ firstName: "Ana", deletedAt: null });
  });

  it("rejects invalid input without writing", async () => {
    const { store } = await testStore();
    await expect(store.insert("clients", clientInput({ phone: "12345" }))).rejects.toThrow();
    expect(await store.pendingCount()).toBe(0);
  });

  it("merges updates and always moves updatedAt forward", async () => {
    const { store } = await testStore();
    const c = await store.insert("clients", clientInput());
    const u = await store.update("clients", c.id, { address: "Makati City" });
    expect(u.address).toBe("Makati City");
    expect(u.firstName).toBe("Ana");
    expect(u.updatedAt > c.updatedAt).toBe(true);
  });

  it("round-trips booleans", async () => {
    const { store } = await testStore();
    const s = await store.insert("settings", {
      currency: "PHP",
      defaultMarkupPct: 30,
      lengthUnit: "in",
      ringSizeSystem: "us",
      materialTracking: true,
    });
    expect((await store.get("settings", s.id))?.materialTracking).toBe(true);
  });

  it("notifies subscribers once per transaction", async () => {
    const { store } = await testStore();
    const listener = vi.fn();
    store.subscribe(listener);
    await store.transaction(async () => {
      await store.insert("clients", clientInput());
      await store.insert("suppliers", { name: "Gold Co", phone: "(02) 8123 4567", address: null, notes: null });
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect([...listener.mock.calls[0]![0]].sort()).toEqual(["clients", "suppliers"]);
  });

  it("rolls back a failed transaction", async () => {
    const { store } = await testStore();
    await expect(
      store.transaction(async () => {
        await store.insert("clients", clientInput());
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await store.query("SELECT * FROM clients")).toHaveLength(0);
    expect(await store.pendingCount()).toBe(0);
  });

  it("emits wire records and tombstones for push", async () => {
    const { store } = await testStore();
    const c = await store.insert("clients", clientInput());
    let [wire] = await store.pendingBatch(10);
    expect(wire).toEqual({ table: "clients", record: expect.objectContaining({ id: c.id, firstName: "Ana" }) });

    await store.setLifecycle("clients", c.id, { deletedAt: store.now(), purgedAt: store.now() });
    [wire] = await store.pendingBatch(10);
    expect(Object.keys(wire!.record).sort()).toEqual(Object.keys(metaSchema.shape).sort());
  });

  it("acknowledges pushed records and keeps ones edited since", async () => {
    const { store, clock } = await testStore();
    const a = await store.insert("clients", clientInput());
    const b = await store.insert("clients", clientInput({ firstName: "Ben" }));
    const batch = await store.pendingBatch(10);
    clock.advance(1000);
    await store.update("clients", b.id, { notes: "VIP" });
    await store.acknowledge(
      batch,
      batch.map((w) => ({ table: w.table, id: String(w.record.id), status: "applied" as const })),
    );
    const left = await store.pendingBatch(10);
    expect(left.map((w) => w.record.id)).toEqual([b.id]);
    expect(left[0]!.record.id).not.toBe(a.id);
  });

  it("stores server-assigned codes", async () => {
    const { store } = await testStore();
    const o = await store.insert("jobOrders", {
      code: null,
      clientId: "01JC000000000000000000CLNT",
      orderDate: "2026-03-01",
      status: "in_production",
      notes: null,
    });
    const batch = await store.pendingBatch(10);
    await store.acknowledge(batch, [{ table: "jobOrders", id: o.id, status: "applied", code: "JO-00007" }]);
    expect((await store.get("jobOrders", o.id))?.code).toBe("JO-00007");
  });

  it("applies remote records unless a newer local edit is pending", async () => {
    const { store, clock } = await testStore();
    const c = await store.insert("clients", clientInput());
    const remoteOlder = { ...c, firstName: "Remote", updatedAt: "2026-01-01T00:00:00.000Z" };
    await store.applyRemote("clients", remoteOlder);
    expect((await store.get("clients", c.id))?.firstName).toBe("Ana");

    clock.advance(1000);
    const remoteNewer = { ...c, firstName: "Remote", updatedAt: "2026-12-01T00:00:00.000Z" };
    await store.applyRemote("clients", remoteNewer);
    expect((await store.get("clients", c.id))?.firstName).toBe("Remote");
    expect(await store.pendingCount()).toBe(0);

    await store.applyRemote("clients", { ...remoteNewer, purgedAt: "2026-12-02T00:00:00.000Z" });
    expect(await store.query("SELECT * FROM clients")).toHaveLength(0);
  });
});
