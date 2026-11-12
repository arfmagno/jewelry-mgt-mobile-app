import { z } from "zod";
import { isTableName, type TableName } from "./records";

/**
 * HTTP API contract between the app and the Lambda.
 *
 *  POST /sync/push        push local changes (last-write-wins per record)
 *  GET  /sync/pull        changes since a server timestamp, paginated
 *  POST /uploads          presigned PUT for a jewelry photo
 *  POST /images/urls      presigned GETs for stored photos
 *  POST /designs/generate AI design image from a description
 */

export const MAX_PUSH_BATCH = 100;
export const MAX_PULL_PAGE = 500;
/** Pull re-reads this window before the last cursor to cover eventually-consistent index writes. */
export const PULL_LOOKBACK_MS = 60_000;

export type WireRecord = { table: TableName; record: Record<string, unknown> };

export const pushRequestSchema = z.object({
  records: z
    .array(
      z.object({
        table: z.string().refine(isTableName, "Unknown table"),
        record: z.record(z.unknown()),
      }),
    )
    .min(1)
    .max(MAX_PUSH_BATCH),
});
export type PushRequest = { records: WireRecord[] };

export type PushResult = {
  table: TableName;
  id: string;
  /** applied: stored. stale: the server already has a newer version (it will arrive on pull). */
  status: "applied" | "stale";
  /** Server-assigned code for coded tables (JW-00001, JO-00001). */
  code?: string | null;
};
export type PushResponse = { results: PushResult[]; serverTime: string };

export const pullQuerySchema = z.object({
  since: z.string().datetime().optional(),
  cursor: z.string().max(2000).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PULL_PAGE).default(MAX_PULL_PAGE),
});
export type PulledRecord = WireRecord & { serverUpdatedAt: string };
export type PullResponse = {
  records: PulledRecord[];
  nextCursor: string | null;
  serverTime: string;
};

export const IMAGE_CONTENT_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;

export const uploadRequestSchema = z.object({
  imageId: z.string().min(10).max(40),
  contentType: z.enum(IMAGE_CONTENT_TYPES),
});
export type UploadRequest = z.infer<typeof uploadRequestSchema>;
export type UploadResponse = { key: string; uploadUrl: string; expiresInSeconds: number };

export const imageUrlsRequestSchema = z.object({
  keys: z.array(z.string().min(1).max(300)).min(1).max(100),
});
export type ImageUrlsResponse = { urls: Record<string, string>; expiresInSeconds: number };

export const generateDesignSchema = z.object({
  description: z.string().trim().min(5).max(1000),
  enhancePrompt: z.boolean().default(true),
});
export type GenerateDesignRequest = z.input<typeof generateDesignSchema>;
export type GenerateDesignResponse = {
  prompt: string;
  model: string;
  contentType: "image/jpeg";
  imageBase64: string;
};

export type ApiErrorBody = { error: { code: string; message: string; details?: unknown } };
