import {
  CODE_PREFIXES,
  formatCode,
  parseRecord,
  pullQuerySchema,
  pushRequestSchema,
  type PullResponse,
  type PushResponse,
  type PushResult,
  type TableName,
} from "@jewelry/shared";
import { badRequest, isZodError, json, type JsonResult } from "../lib/http";
import type { RecordRepo, StoredRecord } from "../lib/records";
import type { Storage } from "../lib/storage";

export type SyncDeps = { repo: RecordRepo; storage: Pick<Storage, "deleteMany">; now: () => Date };

const MAX_RETRIES = 3;

/**
 * Applies pushed records with last-write-wins on the client `updatedAt`.
 * Purged records are terminal. Coded tables get the next sequential code once.
 */
export async function push(userId: string, body: unknown, deps: SyncDeps): Promise<JsonResult> {
  const { records } = pushRequestSchema.parse(body);
  const results: PushResult[] = [];

  for (const { table: t, record: raw } of records) {
    const table = t as TableName;
    let parsed: Record<string, unknown>;
    try {
      parsed = parseRecord(table, raw) as Record<string, unknown>;
    } catch (e) {
      throw badRequest(`Invalid ${table} record ${String(raw.id)}`, isZodError(e) ? e.flatten() : undefined);
    }
    results.push(await applyOne(userId, table, parsed, deps));
  }

  const response: PushResponse = { results, serverTime: deps.now().toISOString() };
  return json(200, response);
}

async function applyOne(
  userId: string,
  table: TableName,
  record: Record<string, unknown>,
  deps: SyncDeps,
): Promise<PushResult> {
  const id = String(record.id);
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const existing = await deps.repo.get(userId, table, id);
    if (existing && (existing.data.purgedAt || existing.updatedAt > String(record.updatedAt))) {
      return { table, id, status: "stale", code: (existing.data.code as string | null | undefined) ?? null };
    }

    const prefix = CODE_PREFIXES[table];
    let code: string | null = null;
    let data = record;
    if (prefix && !record.purgedAt) {
      code = (existing?.data.code as string | null) ?? (record.code as string | null) ?? null;
      if (!code) code = formatCode(prefix, await deps.repo.nextCode(userId, table));
      data = { ...record, code };
    }

    const stored: StoredRecord = {
      table,
      id,
      updatedAt: String(record.updatedAt),
      serverUpdatedAt: deps.now().toISOString(),
      data,
    };
    if (await deps.repo.put(userId, stored, existing?.serverUpdatedAt ?? null)) {
      if (record.purgedAt && table === "jewelryImages") {
        const key = existing?.data.storageKey;
        if (typeof key === "string") {
          await deps.storage.deleteMany([key]).catch((e) => console.error("Failed to delete image", key, e));
        }
      }
      return prefix ? { table, id, status: "applied", code } : { table, id, status: "applied" };
    }
    // Lost a race with a concurrent write: re-read and decide again.
  }
  return { table, id, status: "stale" };
}

export async function pull(
  userId: string,
  query: Record<string, string | undefined>,
  deps: Pick<SyncDeps, "repo" | "now">,
): Promise<JsonResult> {
  const q = pullQuerySchema.parse(query);
  const page = await deps.repo.changesSince(userId, { since: q.since, cursor: q.cursor, limit: q.limit });
  const response: PullResponse = {
    records: page.records.map((r) => ({ table: r.table, record: r.data, serverUpdatedAt: r.serverUpdatedAt })),
    nextCursor: page.nextCursor,
    serverTime: deps.now().toISOString(),
  };
  return json(200, response);
}
