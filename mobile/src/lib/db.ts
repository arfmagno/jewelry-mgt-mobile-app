import { assignMissingCodes, createUlid, hasSampleData, migrate, seedSampleData, Store, type SqlDb, type SqlValue } from "@jewelry/core";
import * as Crypto from "expo-crypto";
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { config } from "@/lib/config";

/** Adapts expo-sqlite to the core `SqlDb` interface. */
export function sqliteAdapter(db: SQLiteDatabase): SqlDb {
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params: SqlValue[] = []) => {
      const r = await db.runAsync(sql, params);
      return { changes: r.changes };
    },
    all: <T>(sql: string, params: SqlValue[] = []) => db.getAllAsync<T>(sql, params),
    first: <T>(sql: string, params: SqlValue[] = []) => db.getFirstAsync<T>(sql, params),
  };
}

const newId = createUlid((n) => Crypto.getRandomValues(new Uint8Array(n)));

export async function openStore(name = "jewelry.db"): Promise<Store> {
  let db: SQLiteDatabase;
  try {
    db = await openDatabaseAsync(name);
  } catch (error) {
    // In the web demo the database file can be locked by another tab or frame
    // running the demo. A demo should still open, so it falls back to a fresh
    // in-memory copy with the sample records. The real app never does this.
    if (!config.demo) throw error;
    db = await openDatabaseAsync(":memory:");
  }
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = OFF;");
  const sql = sqliteAdapter(db);
  await migrate(sql);
  const store = new Store(sql, { newId });
  await assignMissingCodes(store);
  if (config.demo && !(await hasSampleData(store))) await seedSampleData(store);
  return store;
}
