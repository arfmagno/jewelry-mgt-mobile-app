import type { PullResponse, PushResponse } from "@jewelry/shared";
import { describe, expect, it } from "vitest";
import { call, event, fakeStorage, testHandler } from "./support";

const meta = (id: string, updatedAt = "2026-03-01T08:00:00.000Z") => ({
  id,
  createdAt: "2026-03-01T08:00:00.000Z",
  updatedAt,
  deletedAt: null,
  archivedAt: null,
  purgedAt: null,
});

const client = (id: string, over: Record<string, unknown> = {}) => ({
  table: "clients",
  record: { ...meta(id), firstName: "Ana", lastName: "Cruz", phone: "0917 123 4567", address: null, notes: null, ...over },
});

const order = (id: string) => ({
  table: "jobOrders",
  record: { ...meta(id), code: null, clientId: "01JC0000000000000000CLNT01", orderDate: "2026-03-01", status: "in_production", notes: null },
});

describe("API", () => {
  it("serves an unauthenticated health check", async () => {
    const { handler } = testHandler();
    expect(await call(handler, event("GET", "/health", { user: null }))).toEqual({ status: 200, body: { ok: true } });
  });

  it("rejects unauthenticated requests", async () => {
    const { handler } = testHandler();
    const res = await call(handler, event("GET", "/sync/pull", { user: null }));
    expect(res.status).toBe(401);
  });

  it("pushes, normalizes and pulls records", async () => {
    const { handler } = testHandler();
    const pushed = await call<PushResponse>(
      handler,
      event("POST", "/sync/push", { body: { records: [client("01JC0000000000000000CLNT01")] } }),
    );
    expect(pushed.status).toBe(200);
    expect(pushed.body.results).toEqual([{ table: "clients", id: "01JC0000000000000000CLNT01", status: "applied" }]);

    const pulled = await call<PullResponse>(handler, event("GET", "/sync/pull"));
    expect(pulled.body.records).toHaveLength(1);
    expect(pulled.body.records[0]!.record.phone).toBe("+639171234567");
  });

  it("isolates users from each other", async () => {
    const { handler } = testHandler();
    await call(handler, event("POST", "/sync/push", { body: { records: [client("01JC0000000000000000CLNT01")] }, user: "a" }));
    const pulled = await call<PullResponse>(handler, event("GET", "/sync/pull", { user: "b" }));
    expect(pulled.body.records).toEqual([]);
  });

  it("keeps the newest version (last write wins)", async () => {
    const { handler } = testHandler();
    const id = "01JC0000000000000000CLNT01";
    const newer = client(id, { notes: "newer" });
    newer.record.updatedAt = "2026-03-02T00:00:00.000Z";
    await call(handler, event("POST", "/sync/push", { body: { records: [newer] } }));
    const res = await call<PushResponse>(handler, event("POST", "/sync/push", { body: { records: [client(id, { notes: "older" })] } }));
    expect(res.body.results[0]!.status).toBe("stale");
    const pulled = await call<PullResponse>(handler, event("GET", "/sync/pull"));
    expect(pulled.body.records[0]!.record.notes).toBe("newer");
  });

  it("assigns sequential codes once per record", async () => {
    const { handler } = testHandler();
    const a = order("01JC0000000000000000ORDR01");
    const b = order("01JC0000000000000000ORDR02");
    const first = await call<PushResponse>(handler, event("POST", "/sync/push", { body: { records: [a, b] } }));
    expect(first.body.results.map((r) => r.code)).toEqual(["JO-00001", "JO-00002"]);

    a.record.updatedAt = "2026-03-03T00:00:00.000Z";
    const again = await call<PushResponse>(handler, event("POST", "/sync/push", { body: { records: [a] } }));
    expect(again.body.results[0]!.code).toBe("JO-00001");
  });

  it("treats tombstones as final and deletes purged photos", async () => {
    const storage = fakeStorage();
    const { handler } = testHandler({ storage });
    const img = {
      table: "jewelryImages",
      record: {
        ...meta("01JC0000000000000000IMAG01"),
        jewelryId: "01JC0000000000000000JEWL01",
        storageKey: "images/u1/01JC0000000000000000IMAG01.webp",
        source: "upload",
        aiPrompt: null,
        isPrimary: true,
        sortOrder: 0,
      },
    };
    await call(handler, event("POST", "/sync/push", { body: { records: [img] } }));
    const tomb = { table: "jewelryImages", record: { ...meta("01JC0000000000000000IMAG01", "2026-03-09T00:00:00.000Z"), deletedAt: "2026-03-01T09:00:00.000Z", purgedAt: "2026-03-09T00:00:00.000Z" } };
    await call(handler, event("POST", "/sync/push", { body: { records: [tomb] } }));
    expect(storage.deleted).toEqual(["images/u1/01JC0000000000000000IMAG01.webp"]);

    const late = { ...img, record: { ...img.record, updatedAt: "2026-04-01T00:00:00.000Z" } };
    const res = await call<PushResponse>(handler, event("POST", "/sync/push", { body: { records: [late] } }));
    expect(res.body.results[0]!.status).toBe("stale");
  });

  it("validates pushed records", async () => {
    const { handler } = testHandler();
    const bad = client("01JC0000000000000000CLNT01", { phone: "123" });
    const res = await call<{ error: { code: string } }>(handler, event("POST", "/sync/push", { body: { records: [bad] } }));
    expect(res.status).toBe(400);
    const unknown = await call(handler, event("POST", "/sync/push", { body: { records: [{ table: "users", record: {} }] } }));
    expect(unknown.status).toBe(400);
  });

  it("paginates pulls", async () => {
    const { handler } = testHandler();
    const records = Array.from({ length: 5 }, (_, i) => client(`01JC0000000000000000CLNT0${i}`));
    await call(handler, event("POST", "/sync/push", { body: { records } }));
    const p1 = await call<PullResponse>(handler, event("GET", "/sync/pull", { query: { limit: "3" } }));
    expect(p1.body.records).toHaveLength(3);
    const p2 = await call<PullResponse>(handler, event("GET", "/sync/pull", { query: { limit: "3", cursor: p1.body.nextCursor! } }));
    expect(p2.body.records).toHaveLength(2);
    expect(p2.body.nextCursor).toBeNull();
  });

  it("presigns uploads and reads only within the user's prefix", async () => {
    const { handler } = testHandler();
    const up = await call<{ key: string; uploadUrl: string }>(
      handler,
      event("POST", "/uploads", { body: { imageId: "01JC0000000000000000IMAG01", contentType: "image/webp" } }),
    );
    expect(up.body.key).toBe("images/u1/01JC0000000000000000IMAG01.webp");

    const ok = await call<{ urls: Record<string, string> }>(handler, event("POST", "/images/urls", { body: { keys: [up.body.key] } }));
    expect(ok.body.urls[up.body.key]).toContain("r2.test/read");

    const denied = await call(handler, event("POST", "/images/urls", { body: { keys: ["images/u2/x.webp"] } }));
    expect(denied.status).toBe(403);
  });

  it("generates a design image inline", async () => {
    const { handler } = testHandler();
    const res = await call<{ prompt: string; imageBase64: string }>(
      handler,
      event("POST", "/designs/generate", { body: { description: "rose gold ring with oval emerald" } }),
    );
    expect(res.body.prompt).toBe("enhanced: rose gold ring with oval emerald");
    expect(res.body.imageBase64).toBe("/9j/");

    const plain = await call<{ prompt: string }>(
      handler,
      event("POST", "/designs/generate", { body: { description: "simple band", enhancePrompt: false } }),
    );
    expect(plain.body.prompt).toBe("basic: simple band");
  });
});
