import type { PullResponse, PushResponse } from "@jewelry/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { call, event, startDynamo, testHandler } from "../support";

/** Runs the real DynamoDB repository against an in-process DynamoDB (dynalite). */
describe("DynamoDB repository (integration)", () => {
  let dynamo: Awaited<ReturnType<typeof startDynamo>>;

  beforeAll(async () => {
    dynamo = await startDynamo();
  });
  afterAll(() => dynamo.stop());

  const record = (id: string, updatedAt: string, notes: string | null = null) => ({
    table: "clients",
    record: {
      id,
      createdAt: "2026-03-01T08:00:00.000Z",
      updatedAt,
      deletedAt: null,
      archivedAt: null,
      purgedAt: null,
      firstName: "Ana",
      lastName: "Cruz",
      phone: "+639171234567",
      address: null,
      notes,
    },
  });

  it("enforces conditional writes", async () => {
    const rec = { table: "clients" as const, id: "c1", updatedAt: "t1", serverUpdatedAt: "s1", data: {} };
    expect(await dynamo.repo.put("cond", rec, null)).toBe(true);
    expect(await dynamo.repo.put("cond", { ...rec, serverUpdatedAt: "s2" }, null)).toBe(false);
    expect(await dynamo.repo.put("cond", { ...rec, serverUpdatedAt: "s2" }, "s1")).toBe(true);
    expect(await dynamo.repo.put("cond", { ...rec, serverUpdatedAt: "s3" }, "s1")).toBe(false);
  });

  it("allocates codes atomically", async () => {
    const codes = await Promise.all(Array.from({ length: 10 }, () => dynamo.repo.nextCode("codes", "jewelries")));
    expect(codes.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("serves push/pull through the handler with pagination and since", async () => {
    const { handler } = testHandler({ repo: dynamo.repo });
    const records = Array.from({ length: 7 }, (_, i) =>
      record(`01JC0000000000000000CLNT0${i}`, "2026-03-01T08:00:00.000Z"),
    );
    const pushed = await call<PushResponse>(handler, event("POST", "/sync/push", { body: { records }, user: "flow" }));
    expect(pushed.body.results.every((r) => r.status === "applied")).toBe(true);

    const seen: string[] = [];
    let cursor: string | undefined;
    let lastServer = "";
    do {
      const page = await call<PullResponse>(
        handler,
        event("GET", "/sync/pull", { user: "flow", query: { limit: "3", ...(cursor ? { cursor } : {}) } }),
      );
      seen.push(...page.body.records.map((r) => String(r.record.id)));
      for (const r of page.body.records) lastServer = r.serverUpdatedAt > lastServer ? r.serverUpdatedAt : lastServer;
      cursor = page.body.nextCursor ?? undefined;
    } while (cursor);
    expect(seen).toHaveLength(7);

    await call(handler, event("POST", "/sync/push", { user: "flow", body: { records: [record("01JC0000000000000000CLNT03", "2026-03-02T00:00:00.000Z", "changed")] } }));
    const delta = await call<PullResponse>(handler, event("GET", "/sync/pull", { user: "flow", query: { since: lastServer } }));
    expect(delta.body.records.map((r) => r.record.notes)).toEqual(["changed"]);
  });

  it("rejects cursors from another partition", async () => {
    const { handler } = testHandler({ repo: dynamo.repo });
    const forged = Buffer.from(JSON.stringify({ PK: "USER#flow", SK: "x", GSI1PK: "USER#flow", GSI1SK: "x" })).toString("base64url");
    const res = await call(handler, event("GET", "/sync/pull", { user: "attacker", query: { cursor: forged } }));
    expect(res.status).toBe(400);
  });
});
