import initSqlJs, { type Database } from "sql.js";
import { migrate } from "../src/schema";
import type { SqlDb, SqlValue } from "../src/sqldb";
import { Store } from "../src/store";
import { createUlid } from "../src/ulid";

let SQL: Awaited<ReturnType<typeof initSqlJs>> | undefined;

/** In-memory SQLite (WebAssembly) implementing the same SqlDb surface as expo-sqlite. */
export async function memoryDb(): Promise<SqlDb & { raw: Database }> {
  SQL ??= await initSqlJs();
  const raw = new SQL.Database();
  const all = <T>(sql: string, params: SqlValue[] = []): T[] => {
    const stmt = raw.prepare(sql);
    try {
      stmt.bind(params);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  };
  return {
    raw,
    async exec(sql) {
      raw.exec(sql);
    },
    async run(sql, params = []) {
      raw.run(sql, params);
      return { changes: raw.getRowsModified() };
    },
    async all<T>(sql: string, params?: SqlValue[]) {
      return all<T>(sql, params);
    },
    async first<T>(sql: string, params?: SqlValue[]) {
      return all<T>(sql, params)[0] ?? null;
    },
  };
}

/** Controllable clock for deterministic timestamps. */
export function testClock(start = "2026-03-01T08:00:00.000Z") {
  let t = Date.parse(start);
  return {
    now: () => new Date(t),
    advance(ms: number) {
      t += ms;
    },
    advanceDays(days: number) {
      t += days * 86_400_000;
    },
  };
}

export async function testStore(clock = testClock()) {
  const db = await memoryDb();
  await migrate(db);
  const store = new Store(db, { now: clock.now, newId: createUlid(undefined, () => clock.now().getTime()) });
  return { store, db, clock };
}

export const clientInput = (over: Record<string, unknown> = {}) => ({
  firstName: "Ana",
  lastName: "Cruz",
  phone: "0917 123 4567",
  address: null,
  notes: null,
  ...over,
});

export const ringDraft = (over: Record<string, unknown> = {}) => ({
  description: "18K yellow gold solitaire ring",
  origin: "on_hand" as const,
  manufactureDate: "2026-02-20",
  sameMetalForAll: true,
  metal: "gold" as const,
  purity: "18K",
  metalColor: "yellow" as const,
  weightG: 3.2,
  notes: null,
  components: [
    {
      type: "ring" as const,
      metal: null,
      purity: null,
      metalColor: null,
      weightG: null,
      ringSizeMm: 17.3,
      earringBack: null,
      lengthMm: null,
      style: null,
      widthMm: null,
      notes: null,
      stones: [
        {
          stoneKind: "lab_grown_diamond" as const,
          gemName: null,
          shape: "round" as const,
          quantity: 1,
          sizeMm: 6.5,
          totalCarat: 1,
          colorGrade: "F",
          clarityGrade: "VS1",
          setting: "prong" as const,
          supplierId: null,
          materialId: null,
          notes: null,
        },
      ],
    },
  ],
  costs: [
    {
      category: "metal" as const,
      description: "18K gold",
      supplierId: null,
      materialId: null,
      quantity: 3.2,
      unitCost: 400000,
    },
    {
      category: "labor" as const,
      description: "Stone setting",
      supplierId: null,
      materialId: null,
      quantity: 1,
      unitCost: 50000,
    },
  ],
  images: [],
  ...over,
});
