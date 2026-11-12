import { createUlid, migrate, Store, type SqlDb, type SqlValue } from "@jewelry/core";
import * as Crypto from "expo-crypto";
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

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
  const db = await openDatabaseAsync(name);
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = OFF;");
  const sql = sqliteAdapter(db);
  await migrate(sql);
  return new Store(sql, { newId });
}
