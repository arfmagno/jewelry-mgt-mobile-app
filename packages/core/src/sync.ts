import {
  MAX_PULL_PAGE,
  MAX_PUSH_BATCH,
  PULL_LOOKBACK_MS,
  type PullResponse,
  type PushRequest,
  type PushResponse,
  type UploadRequest,
  type UploadResponse,
} from "@jewelry/shared";
import { purgeExpired } from "./lifecycle";
import type { Store } from "./store";

/** Network side of sync; the app implements it over fetch, tests call the Lambda handler directly. */
export interface SyncTransport {
  push(body: PushRequest): Promise<PushResponse>;
  pull(query: { since?: string; cursor?: string; limit?: number }): Promise<PullResponse>;
}

export type SyncReport = { pushed: number; pulled: number; purged: number; archived: number };

export type SyncStatus =
  | { state: "idle"; lastSyncedAt: string | null; pending: number }
  | { state: "syncing"; lastSyncedAt: string | null; pending: number }
  | { state: "error"; lastSyncedAt: string | null; pending: number; error: string };

const CURSOR_KEY = "pull.lastServerUpdatedAt";
const LAST_SYNC_KEY = "sync.lastSyncedAt";

/**
 * Push-then-pull sync.
 *  - Push sends queued records in batches; the server applies last-write-wins by `updatedAt`.
 *  - Pull fetches everything changed since the last seen server timestamp (minus a small
 *    lookback window) and applies it; applying is idempotent, so overlap is harmless.
 */
export class SyncEngine {
  private running: Promise<SyncReport> | null = null;
  private listeners = new Set<(s: SyncStatus) => void>();
  private status: SyncStatus = { state: "idle", lastSyncedAt: null, pending: 0 };

  constructor(
    private readonly store: Store,
    private readonly transport: SyncTransport,
  ) {}

  subscribe(listener: (s: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  async refreshStatus(): Promise<void> {
    const [pending, lastSyncedAt] = await Promise.all([
      this.store.pendingCount(),
      this.store.getState(LAST_SYNC_KEY),
    ]);
    if (this.status.state !== "syncing") {
      this.setStatus(
        this.status.state === "error"
          ? { ...this.status, pending, lastSyncedAt }
          : { state: "idle", pending, lastSyncedAt },
      );
    }
  }

  private setStatus(s: SyncStatus) {
    this.status = s;
    for (const l of this.listeners) l(s);
  }

  /** Runs one sync; concurrent callers share the in-flight run. */
  sync(): Promise<SyncReport> {
    this.running ??= this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async run(): Promise<SyncReport> {
    const lastSyncedAt = await this.store.getState(LAST_SYNC_KEY);
    this.setStatus({ state: "syncing", lastSyncedAt, pending: await this.store.pendingCount() });
    try {
      const { purged, archived } = await purgeExpired(this.store);
      const pushed = await this.push();
      const pulled = await this.pull();
      const now = this.store.now();
      await this.store.setState(LAST_SYNC_KEY, now);
      this.setStatus({ state: "idle", lastSyncedAt: now, pending: await this.store.pendingCount() });
      return { pushed, pulled, purged, archived };
    } catch (e) {
      this.setStatus({
        state: "error",
        lastSyncedAt,
        pending: await this.store.pendingCount(),
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }

  private async push(): Promise<number> {
    let total = 0;
    // Bounded loop: each pass either drains entries or the server rejects the batch (throws).
    for (let pass = 0; pass < 1000; pass++) {
      const batch = await this.store.pendingBatch(MAX_PUSH_BATCH);
      if (batch.length === 0) break;
      const res = await this.transport.push({ records: batch });
      await this.store.acknowledge(batch, res.results);
      total += batch.length;
      if (batch.length < MAX_PUSH_BATCH) break;
    }
    return total;
  }

  private async pull(): Promise<number> {
    const last = await this.store.getState(CURSOR_KEY);
    const since = last ? new Date(Date.parse(last) - PULL_LOOKBACK_MS).toISOString() : undefined;
    let cursor: string | undefined;
    let maxSeen = last;
    let total = 0;
    do {
      const page = await this.transport.pull({ since, cursor, limit: MAX_PULL_PAGE });
      await this.store.transaction(async () => {
        for (const r of page.records) {
          await this.store.applyRemote(r.table, r.record);
          if (!maxSeen || r.serverUpdatedAt > maxSeen) maxSeen = r.serverUpdatedAt;
        }
      });
      total += page.records.length;
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    if (maxSeen) await this.store.setState(CURSOR_KEY, maxSeen);
    return total;
  }
}

// ── Photo uploads ─────────────────────────────────────────────────────────

export interface UploadTransport {
  requestUpload(body: UploadRequest): Promise<UploadResponse>;
  /** PUT the local file to the presigned URL. */
  putFile(uploadUrl: string, localUri: string, contentType: string): Promise<void>;
}

const contentTypeOf = (uri: string): UploadRequest["contentType"] =>
  uri.endsWith(".png") ? "image/png" : uri.endsWith(".jpg") || uri.endsWith(".jpeg") ? "image/jpeg" : "image/webp";

/** Uploads photos that exist only on this device, then records their storage key (which syncs). */
export async function uploadPendingImages(store: Store, transport: UploadTransport): Promise<number> {
  const pending = await store.query<{ id: string; localUri: string }>(
    `SELECT id, localUri FROM jewelryImages
     WHERE storageKey IS NULL AND localUri IS NOT NULL AND deletedAt IS NULL AND purgedAt IS NULL`,
  );
  let uploaded = 0;
  for (const img of pending) {
    const contentType = contentTypeOf(img.localUri);
    const { key, uploadUrl } = await transport.requestUpload({ imageId: img.id, contentType });
    await transport.putFile(uploadUrl, img.localUri, contentType);
    await store.update("jewelryImages", img.id, { storageKey: key });
    uploaded++;
  }
  return uploaded;
}
