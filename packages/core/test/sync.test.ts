import {
  CODE_PREFIXES,
  formatCode,
  type PullResponse,
  type PushRequest,
  type PushResponse,
  type PulledRecord,
} from "@jewelry/shared";
import { describe, expect, it, vi } from "vitest";
import { saveJewelry } from "../src/aggregates";
import { softDelete } from "../src/lifecycle";
import { uploadPendingImages, SyncEngine, type SyncTransport } from "../src/sync";
import { clientInput, ringDraft, testClock, testStore } from "./helpers";

/** In-memory server with the same semantics as the Lambda (LWW, codes, tombstones). */
function fakeServer(clock: { now: () => Date }) {
  const records = new Map<string, PulledRecord>();
  const counters = new Map<string, number>();
  let tick = 0;
  const serverNow = () => new Date(clock.now().getTime() + tick++).toISOString();

  const transport: SyncTransport = {
    async push({ records: incoming }: PushRequest): Promise<PushResponse> {
      const results = incoming.map(({ table, record }) => {
        const key = `${table}/${record.id}`;
        const existing = records.get(key);
        if (existing && (existing.record.purgedAt || String(existing.record.updatedAt) > String(record.updatedAt))) {
          return { table, id: String(record.id), status: "stale" as const };
        }
        let code = (existing?.record.code as string | null | undefined) ?? (record.code as string | null | undefined) ?? null;
        const prefix = CODE_PREFIXES[table];
        if (prefix && !code && !record.purgedAt) {
          const n = (counters.get(table) ?? 0) + 1;
          counters.set(table, n);
          code = formatCode(prefix, n);
        }
        const stored = prefix && !record.purgedAt ? { ...record, code } : record;
        records.set(key, { table, record: stored, serverUpdatedAt: serverNow() });
        return { table, id: String(record.id), status: "applied" as const, code };
      });
      return { results, serverTime: serverNow() };
    },
    async pull({ since }): Promise<PullResponse> {
      const out = [...records.values()]
        .filter((r) => !since || r.serverUpdatedAt > since)
        .sort((a, b) => a.serverUpdatedAt.localeCompare(b.serverUpdatedAt));
      return { records: out, nextCursor: null, serverTime: serverNow() };
    },
  };
  return { transport, records };
}

describe("SyncEngine", () => {
  it("pushes local changes, assigns codes and converges a second device", async () => {
    const clock = testClock();
    const server = fakeServer(clock);
    const a = await testStore(clock);
    const b = await testStore(clock);
    const syncA = new SyncEngine(a.store, server.transport);
    const syncB = new SyncEngine(b.store, server.transport);

    const client = await a.store.insert("clients", clientInput());
    const pieceId = await saveJewelry(a.store, ringDraft());

    const report = await syncA.sync();
    expect(report.pushed).toBe(6);
    expect(await a.store.pendingCount()).toBe(0);
    expect((await a.store.get("jewelries", pieceId))?.code).toBe("JW-00001");

    await syncB.sync();
    expect((await b.store.get("clients", client.id))?.firstName).toBe("Ana");
    expect((await b.store.get("jewelries", pieceId))?.code).toBe("JW-00001");
  });

  it("resolves concurrent edits with last-write-wins", async () => {
    const clock = testClock();
    const server = fakeServer(clock);
    const a = await testStore(clock);
    const b = await testStore(clock);
    const syncA = new SyncEngine(a.store, server.transport);
    const syncB = new SyncEngine(b.store, server.transport);

    const c = await a.store.insert("clients", clientInput());
    await syncA.sync();
    await syncB.sync();

    clock.advance(1000);
    await a.store.update("clients", c.id, { notes: "from A" });
    clock.advance(1000);
    await b.store.update("clients", c.id, { notes: "from B (newer)" });

    await syncA.sync();
    await syncB.sync();
    await syncA.sync();
    expect((await a.store.get("clients", c.id))?.notes).toBe("from B (newer)");
    expect((await b.store.get("clients", c.id))?.notes).toBe("from B (newer)");
  });

  it("syncs purges as tombstones and removes rows everywhere", async () => {
    const clock = testClock();
    const server = fakeServer(clock);
    const a = await testStore(clock);
    const b = await testStore(clock);
    const syncA = new SyncEngine(a.store, server.transport);
    const syncB = new SyncEngine(b.store, server.transport);

    const c = await a.store.insert("clients", clientInput());
    await syncA.sync();
    await syncB.sync();

    await softDelete(a.store, "clients", c.id);
    clock.advanceDays(8);
    const report = await syncA.sync();
    expect(report.purged).toBe(1);
    expect(await a.store.query("SELECT id FROM clients")).toHaveLength(0);

    await syncB.sync();
    expect(await b.store.query("SELECT id FROM clients")).toHaveLength(0);
  });

  it("reports status transitions and errors", async () => {
    const { store } = await testStore();
    const failing: SyncTransport = {
      push: vi.fn().mockRejectedValue(new Error("offline")),
      pull: vi.fn(),
    };
    const engine = new SyncEngine(store, failing);
    const states: string[] = [];
    engine.subscribe((s) => states.push(s.state));
    await store.insert("clients", clientInput());
    await expect(engine.sync()).rejects.toThrow("offline");
    expect(states).toEqual(["idle", "syncing", "error"]);
    expect(engine.getStatus()).toMatchObject({ state: "error", pending: 1, error: "offline" });
  });

  it("shares one in-flight run between concurrent callers", async () => {
    const clock = testClock();
    const server = fakeServer(clock);
    const pull = vi.spyOn(server.transport, "pull");
    const { store } = await testStore(clock);
    const engine = new SyncEngine(store, server.transport);
    await Promise.all([engine.sync(), engine.sync(), engine.sync()]);
    expect(pull).toHaveBeenCalledTimes(1);
  });
});

describe("uploadPendingImages", () => {
  it("uploads local-only photos and records their storage key", async () => {
    const { store } = await testStore();
    const pieceId = await saveJewelry(
      store,
      ringDraft({
        images: [{ id: "01JC0000000000000000IMAGE1", storageKey: null, source: "upload", aiPrompt: null, isPrimary: true, localUri: "file:///photos/a.webp" }],
      }),
    );
    const transport = {
      requestUpload: vi.fn(async ({ imageId }: { imageId: string }) => ({
        key: `images/user/${imageId}.webp`,
        uploadUrl: "https://upload.example/put",
        expiresInSeconds: 600,
      })),
      putFile: vi.fn(async () => undefined),
    };
    expect(await uploadPendingImages(store, transport)).toBe(1);
    expect(transport.putFile).toHaveBeenCalledWith("https://upload.example/put", "file:///photos/a.webp", "image/webp");
    const [img] = await store.select("jewelryImages", "jewelryId = ?", [pieceId]);
    expect(img?.storageKey).toBe("images/user/01JC0000000000000000IMAGE1.webp");
    expect(await uploadPendingImages(store, transport)).toBe(0);
  });
});
