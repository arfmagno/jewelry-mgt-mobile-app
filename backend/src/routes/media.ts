import {
  generateDesignSchema,
  imageUrlsRequestSchema,
  uploadRequestSchema,
  type GenerateDesignResponse,
  type ImageUrlsResponse,
  type UploadResponse,
} from "@jewelry/shared";
import type { DesignGenerator } from "../lib/ai";
import { HttpError, json, type JsonResult } from "../lib/http";
import { READ_URL_TTL_SECONDS, storageKeys, UPLOAD_URL_TTL_SECONDS, type Storage } from "../lib/storage";

const EXTENSIONS = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" } as const;

export async function createUpload(userId: string, body: unknown, storage: Storage): Promise<JsonResult> {
  const { imageId, contentType } = uploadRequestSchema.parse(body);
  const key = storageKeys.image(userId, imageId, EXTENSIONS[contentType]);
  const response: UploadResponse = {
    key,
    uploadUrl: await storage.presignUpload(key, contentType),
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  };
  return json(200, response);
}

export async function imageUrls(userId: string, body: unknown, storage: Storage): Promise<JsonResult> {
  const { keys } = imageUrlsRequestSchema.parse(body);
  const prefix = storageKeys.imagePrefix(userId);
  if (keys.some((k) => !k.startsWith(prefix))) {
    throw new HttpError(403, "forbidden", "Image does not belong to this account");
  }
  const urls = Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await storage.presignRead(k)])));
  const response: ImageUrlsResponse = { urls, expiresInSeconds: READ_URL_TTL_SECONDS };
  return json(200, response);
}

/**
 * Generates a design concept. The image is returned inline and never stored:
 * the app keeps it only if the user chooses to, then uploads it like any photo.
 */
export async function generateDesign(body: unknown, ai: DesignGenerator): Promise<JsonResult> {
  const { description, enhancePrompt } = generateDesignSchema.parse(body);
  const prompt = enhancePrompt ? await ai.enhancePrompt(description) : ai.basicPrompt(description);
  const image = await ai.generateImage(prompt);
  const response: GenerateDesignResponse = {
    prompt,
    model: ai.model,
    contentType: "image/jpeg",
    imageBase64: Buffer.from(image).toString("base64"),
  };
  return json(200, response);
}
