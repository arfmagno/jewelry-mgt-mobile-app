import {
  BOOLEAN_FIELDS,
  fieldNames,
  fieldSchemas,
  metaSchema,
  type Fields,
  type FieldsInput,
  type Meta,
  type PushResult,
  type RecordOf,
  type TableName,
  type WireRecord,
} from "@jewelry/shared";
import { LOCAL_ONLY_COLUMNS } from "./schema";
import { Mutex, type SqlDb, type SqlValue } from "./sqldb";
import { ulid } from "./ulid";

export type ChangeListener = (tables: ReadonlySet<TableName>) => void;

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type Row = Record<string, SqlValue>;

const META_KEYS = Object.keys(metaSchema.shape) as (keyof Meta)[];

const columnsOf = (table: TableName): string[] => [...META_KEYS, ...fieldNames(table)];

/**
 * The on-device source of truth. Every local write:
 *  1. is validated with the shared zod schema,
 *  2. bumps `updatedAt`,
 *  3. is queued in the outbox for the next push,
 *  4. notifies subscribers (screens re-query).
 */
export class Store {
  private listeners = new Set<ChangeListener>();
  private mutex = new Mutex();
  private txDepth = 0;
  private pendingNotify = new Set<TableName>();

  constructor(
    readonly db: SqlDb,
    private readonly opts: { now?: () => Date; newId?: () => string } = {},
  ) {}

  now(): string {
    return (this.opts.now?.() ?? new Date()).toISOString();
  }

  newId(): string {
    return this.opts.newId?.() ?? ulid();
  }

  // ── Change notifications ──────────────────────────────────────────────

  subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(table: TableName) {
    this.pendingNotify.add(table);
    if (this.txDepth === 0) this.flushNotify();
  }

  private flushNotify() {
    if (this.pendingNotify.size === 0) return;
    const tables = new Set(this.pendingNotify);
    this.pendingNotify.clear();
    for (const l of this.listeners) l(tables);
  }

  // ── Transactions ──────────────────────────────────────────────────────

  /** Runs `fn` atomically. Nested calls join the outer transaction. */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.txDepth > 0) {
      this.txDepth++;
      try {
        return await fn();
      } finally {
        this.txDepth--;
      }
    }
    return this.mutex.run(async () => {
      this.txDepth = 1;
      await this.db.exec("BEGIN");
      try {
        const result = await fn();
        await this.db.exec("COMMIT");
        this.txDepth = 0;
        this.flushNotify();
        return result;
      } catch (e) {
        await this.db.exec("ROLLBACK");
        this.txDepth = 0;
        this.pendingNotify.clear();
        throw e;
      }
    });
  }

  // ── Row mapping ───────────────────────────────────────────────────────

  private fromRow<T extends TableName>(table: T, row: Row): RecordOf<T> {
    const out: Record<string, unknown> = { ...row };
    for (const f of BOOLEAN_FIELDS[table] ?? []) {
      if (out[f] != null) out[f] = out[f] === 1;
    }
    return out as unknown as RecordOf<T>;
  }

  private toRow(table: TableName, record: Record<string, unknown>): Row {
    const row: Row = {};
    const bools = BOOLEAN_FIELDS[table] ?? [];
    for (const col of columnsOf(table)) {
      const v = record[col];
      row[col] = v === undefined ? null : bools.includes(col) && v != null ? (v ? 1 : 0) : (v as SqlValue);
    }
    return row;
  }

  private async writeRow(table: TableName, record: Record<string, unknown>) {
    const row = this.toRow(table, record);
    const cols = Object.keys(row);
    const updates = cols.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`);
    await this.db.run(
      `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})
       ON CONFLICT(id) DO UPDATE SET ${updates.join(", ")}`,
      cols.map((c) => row[c] ?? null),
    );
  }

  // ── Reads ─────────────────────────────────────────────────────────────

  async get<T extends TableName>(table: T, id: string): Promise<RecordOf<T> | null> {
    const row = await this.db.first<Row>(`SELECT * FROM ${table} WHERE id = ? AND purgedAt IS NULL`, [id]);
    return row ? this.fromRow(table, row) : null;
  }

  async require<T extends TableName>(table: T, id: string): Promise<RecordOf<T>> {
    const rec = await this.get(table, id);
    if (!rec) throw new DomainError("not_found", `${table} ${id} not found`);
    return rec;
  }

  async select<T extends TableName>(table: T, where: string, params: SqlValue[] = []): Promise<RecordOf<T>[]> {
    const rows = await this.db.all<Row>(`SELECT * FROM ${table} WHERE ${where}`, params);
    return rows.map((r) => this.fromRow(table, r));
  }

  /** Raw query returning plain rows (for joins and aggregates). */
  query<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return this.db.all<T>(sql, params);
  }

  // ── Local writes (queued for sync) ────────────────────────────────────

  async insert<T extends TableName>(
    table: T,
    input: FieldsInput<T>,
    opts: { id?: string } = {},
  ): Promise<RecordOf<T>> {
    const fields = fieldSchemas[table].parse(input) as Fields<T>;
    const now = this.now();
    const record = {
      id: opts.id ?? this.newId(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      archivedAt: null,
      purgedAt: null,
      ...fields,
    } as RecordOf<T>;
    await this.transaction(async () => {
      await this.writeRow(table, record);
      await this.enqueue(table, record.id);
    });
    this.notify(table);
    return record;
  }

  async update<T extends TableName>(
    table: T,
    id: string,
    patch: Partial<FieldsInput<T>>,
  ): Promise<RecordOf<T>> {
    return this.transaction(async () => {
      const existing = await this.require(table, id);
      const merged = { ...pickFields(table, existing), ...patch };
      const fields = fieldSchemas[table].parse(merged) as Fields<T>;
      const record = { ...existing, ...fields, updatedAt: this.later(existing.updatedAt) } as RecordOf<T>;
      await this.writeRow(table, record);
      await this.enqueue(table, id);
      this.notify(table);
      return record;
    });
  }

  /** Insert when `id` is new, otherwise update. */
  async upsert<T extends TableName>(table: T, id: string | undefined, input: FieldsInput<T>) {
    if (id && (await this.get(table, id))) return this.update(table, id, input);
    return this.insert(table, input, { id });
  }

  /** Updates lifecycle columns (deletedAt / archivedAt / purgedAt). */
  async setLifecycle(
    table: TableName,
    id: string,
    patch: Partial<Pick<Meta, "deletedAt" | "archivedAt" | "purgedAt">>,
  ): Promise<void> {
    await this.transaction(async () => {
      const existing = await this.db.first<{ updatedAt: string }>(`SELECT updatedAt FROM ${table} WHERE id = ?`, [id]);
      if (!existing) return;
      const sets = Object.keys(patch).map((k) => `${k} = ?`);
      await this.db.run(`UPDATE ${table} SET ${sets.join(", ")}, updatedAt = ? WHERE id = ?`, [
        ...Object.values(patch).map((v) => v ?? null),
        this.later(existing.updatedAt),
        id,
      ]);
      await this.enqueue(table, id);
      this.notify(table);
    });
  }

  /** Device-local column update that is not synced (e.g. a photo's local file path). */
  async setLocal(table: TableName, id: string, column: string, value: SqlValue) {
    if (!(LOCAL_ONLY_COLUMNS[table] ?? []).includes(column)) throw new Error(`${column} is not local-only`);
    await this.db.run(`UPDATE ${table} SET ${column} = ? WHERE id = ?`, [value, id]);
    this.notify(table);
  }

  /** Strictly increasing timestamp even if the clock hasn't moved. */
  private later(previous: string): string {
    const now = this.now();
    if (now > previous) return now;
    return new Date(Date.parse(previous) + 1).toISOString();
  }

  private async enqueue(table: TableName, id: string) {
    await this.db.run("INSERT OR IGNORE INTO outbox (tableName, recordId) VALUES (?, ?)", [table, id]);
  }

  // ── Sync support ──────────────────────────────────────────────────────

  async pendingCount(): Promise<number> {
    const row = await this.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM outbox");
    return row?.n ?? 0;
  }

  /** Next batch of queued records in wire format (tombstones carry meta only). */
  async pendingBatch(limit: number): Promise<WireRecord[]> {
    const entries = await this.db.all<{ tableName: TableName; recordId: string }>(
      "SELECT tableName, recordId FROM outbox LIMIT ?",
      [limit],
    );
    const out: WireRecord[] = [];
    for (const { tableName, recordId } of entries) {
      const row = await this.db.first<Row>(`SELECT * FROM ${tableName} WHERE id = ?`, [recordId]);
      if (!row) {
        await this.db.run("DELETE FROM outbox WHERE tableName = ? AND recordId = ?", [tableName, recordId]);
        continue;
      }
      out.push({ table: tableName, record: this.toWire(tableName, row) });
    }
    return out;
  }

  private toWire(table: TableName, row: Row): Record<string, unknown> {
    const rec = this.fromRow(table, row) as Record<string, unknown>;
    const keys = rec.purgedAt ? META_KEYS : columnsOf(table);
    return Object.fromEntries(keys.map((k) => [k, rec[k] ?? null]));
  }

  /** Clears outbox entries the server accepted, unless the record changed again meanwhile. */
  async acknowledge(sent: WireRecord[], results: PushResult[]): Promise<void> {
    const sentAt = new Map(sent.map((s) => [`${s.table}/${s.record.id}`, s.record.updatedAt]));
    await this.transaction(async () => {
      for (const r of results) {
        const current = await this.db.first<{ updatedAt: string; purgedAt: string | null; code?: string | null }>(
          `SELECT * FROM ${r.table} WHERE id = ?`,
          [r.id],
        );
        if (r.code && current && !current.code) {
          await this.db.run(`UPDATE ${r.table} SET code = ? WHERE id = ?`, [r.code, r.id]);
          this.notify(r.table);
        }
        if (!current || current.updatedAt !== sentAt.get(`${r.table}/${r.id}`)) continue;
        await this.db.run("DELETE FROM outbox WHERE tableName = ? AND recordId = ?", [r.table, r.id]);
        if (current.purgedAt) {
          await this.db.run(`DELETE FROM ${r.table} WHERE id = ?`, [r.id]);
        }
      }
    });
  }

  /** Applies a record pulled from the server. Unpushed local edits that are newer win. */
  async applyRemote(table: TableName, record: Record<string, unknown>): Promise<void> {
    const id = String(record.id);
    const local = await this.db.first<{ updatedAt: string }>(`SELECT updatedAt FROM ${table} WHERE id = ?`, [id]);
    const queued = await this.db.first("SELECT 1 FROM outbox WHERE tableName = ? AND recordId = ?", [table, id]);
    if (local && queued && local.updatedAt > String(record.updatedAt)) return;

    if (record.purgedAt) {
      await this.db.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
    } else {
      await this.writeRow(table, record);
    }
    await this.db.run("DELETE FROM outbox WHERE tableName = ? AND recordId = ?", [table, id]);
    this.notify(table);
  }

  async getState(key: string): Promise<string | null> {
    const row = await this.db.first<{ value: string | null }>("SELECT value FROM syncState WHERE key = ?", [key]);
    return row?.value ?? null;
  }

  async setState(key: string, value: string | null): Promise<void> {
    await this.db.run(
      "INSERT INTO syncState (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [key, value],
    );
  }
}

function pickFields<T extends TableName>(table: T, rec: RecordOf<T>): Record<string, unknown> {
  const r = rec as Record<string, unknown>;
  return Object.fromEntries(fieldNames(table).map((k) => [k, r[k]]));
}
