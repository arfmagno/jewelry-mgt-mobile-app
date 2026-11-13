import type { SqlDb } from "./sqldb";

/**
 * Versioned local schema migrations (PRAGMA user_version).
 * Never edit a released migration — append a new one.
 *
 * Integrity (references, enums, required fields) is enforced by the shared
 * zod schemas, not SQL constraints, because sync can deliver records in any order.
 */

const META = `
  id TEXT PRIMARY KEY NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  archivedAt TEXT,
  purgedAt TEXT`;

const METAL = `
  metal TEXT,
  purity TEXT,
  metalColor TEXT,
  weightG REAL`;

export const MIGRATIONS: readonly string[] = [
  /* 1 — initial schema */ `
  CREATE TABLE settings (${META},
    currency TEXT, defaultMarkupPct REAL, lengthUnit TEXT, ringSizeSystem TEXT, materialTracking INTEGER);

  CREATE TABLE clients (${META},
    firstName TEXT, lastName TEXT, phone TEXT, address TEXT, notes TEXT);
  CREATE INDEX clients_name ON clients (lastName, firstName);

  CREATE TABLE suppliers (${META},
    name TEXT, phone TEXT, address TEXT, notes TEXT);
  CREATE INDEX suppliers_name ON suppliers (name);

  CREATE TABLE materials (${META},
    name TEXT, kind TEXT, unit TEXT, metal TEXT, purity TEXT, notes TEXT);

  CREATE TABLE purchases (${META},
    supplierId TEXT, purchaseDate TEXT, notes TEXT);
  CREATE INDEX purchases_supplier ON purchases (supplierId, purchaseDate);

  CREATE TABLE purchaseLines (${META},
    purchaseId TEXT, materialId TEXT, quantity REAL, unitPrice INTEGER);
  CREATE INDEX purchaseLines_purchase ON purchaseLines (purchaseId);
  CREATE INDEX purchaseLines_material ON purchaseLines (materialId);

  CREATE TABLE stockAdjustments (${META},
    materialId TEXT, quantity REAL, reason TEXT, date TEXT, notes TEXT);
  CREATE INDEX stockAdjustments_material ON stockAdjustments (materialId);

  CREATE TABLE jewelries (${META},
    code TEXT, description TEXT, origin TEXT, manufactureDate TEXT, sameMetalForAll INTEGER,${METAL},
    notes TEXT);
  CREATE INDEX jewelries_code ON jewelries (code);

  CREATE TABLE jewelryComponents (${META},
    jewelryId TEXT, type TEXT, sortOrder INTEGER,${METAL},
    ringSizeMm REAL, earringBack TEXT, lengthMm REAL, style TEXT, widthMm REAL, notes TEXT);
  CREATE INDEX jewelryComponents_jewelry ON jewelryComponents (jewelryId);

  CREATE TABLE jewelryStones (${META},
    componentId TEXT, stoneKind TEXT, gemName TEXT, shape TEXT, quantity INTEGER, sizeMm REAL,
    totalCarat REAL, colorGrade TEXT, clarityGrade TEXT, setting TEXT, supplierId TEXT,
    materialId TEXT, notes TEXT);
  CREATE INDEX jewelryStones_component ON jewelryStones (componentId);

  CREATE TABLE jewelryCosts (${META},
    jewelryId TEXT, category TEXT, description TEXT, supplierId TEXT, workerName TEXT,
    materialId TEXT, quantity REAL, unitCost INTEGER);
  CREATE INDEX jewelryCosts_jewelry ON jewelryCosts (jewelryId);
  CREATE INDEX jewelryCosts_material ON jewelryCosts (materialId);

  CREATE TABLE jewelryImages (${META},
    jewelryId TEXT, storageKey TEXT, source TEXT, aiPrompt TEXT, isPrimary INTEGER, sortOrder INTEGER,
    localUri TEXT);
  CREATE INDEX jewelryImages_jewelry ON jewelryImages (jewelryId);

  CREATE TABLE jobOrders (${META},
    code TEXT, clientId TEXT, orderDate TEXT, status TEXT, notes TEXT);
  CREATE INDEX jobOrders_client ON jobOrders (clientId);
  CREATE INDEX jobOrders_date ON jobOrders (orderDate);

  CREATE TABLE jobOrderItems (${META},
    jobOrderId TEXT, jewelryId TEXT, sellingPrice INTEGER);
  CREATE INDEX jobOrderItems_order ON jobOrderItems (jobOrderId);
  CREATE INDEX jobOrderItems_jewelry ON jobOrderItems (jewelryId);

  CREATE TABLE payments (${META},
    jobOrderId TEXT, amount INTEGER, paidAt TEXT, method TEXT, notes TEXT);
  CREATE INDEX payments_order ON payments (jobOrderId);

  -- Sync bookkeeping (device-local, never synced)
  CREATE TABLE outbox (tableName TEXT NOT NULL, recordId TEXT NOT NULL, PRIMARY KEY (tableName, recordId));
  CREATE TABLE syncState (key TEXT PRIMARY KEY NOT NULL, value TEXT);
  `,

  /* 2 — cost lines no longer record a worker name */ `
  ALTER TABLE jewelryCosts DROP COLUMN workerName;
  `,

  /* 3 — stones carry their own price; clarity grade is no longer recorded */ `
  ALTER TABLE jewelryStones DROP COLUMN clarityGrade;
  ALTER TABLE jewelryStones ADD COLUMN unitCost INTEGER;
  `,
];

/** Columns that exist only on the device and are never sent to the server. */
export const LOCAL_ONLY_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  jewelryImages: ["localUri"],
};

export async function migrate(db: SqlDb): Promise<void> {
  const row = await db.first<{ user_version: number }>("PRAGMA user_version");
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.exec("BEGIN");
    try {
      await db.exec(MIGRATIONS[v]!);
      await db.exec(`PRAGMA user_version = ${v + 1}`);
      await db.exec("COMMIT");
    } catch (e) {
      await db.exec("ROLLBACK");
      throw e;
    }
  }
}
