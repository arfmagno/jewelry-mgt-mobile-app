export type SqlValue = string | number | null;

/**
 * Minimal async SQLite surface. The app adapts expo-sqlite to it; tests use sql.js.
 * Transactions are managed by the Store (BEGIN/COMMIT via `exec`) so adapters stay trivial.
 */
export interface SqlDb {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
}

/** Serializes async critical sections (one write transaction at a time). */
export class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn, fn);
    this.tail = result.catch(() => undefined);
    return result;
  }
}
