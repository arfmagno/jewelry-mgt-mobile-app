import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env, getSecrets } from "./config";

/**
 * Cloudflare R2 (S3-compatible, 10 GB free, zero egress).
 * Swapping to AWS S3 later only means dropping the custom endpoint.
 */
let client: S3Client | undefined;

async function s3(): Promise<S3Client> {
  if (client) return client;
  const secrets = await getSecrets();
  client = new S3Client({
    region: "auto",
    endpoint: `https://${env.cloudflareAccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: secrets.r2AccessKeyId,
      secretAccessKey: secrets.r2SecretAccessKey,
    },
  });
  return client;
}

export const UPLOAD_URL_TTL_SECONDS = 600;
export const READ_URL_TTL_SECONDS = 3600;

export const storageKeys = {
  imagePrefix: (sub: string) => `images/${sub}/`,
  image: (sub: string, id: string, ext: string) => `images/${sub}/${id}.${ext}`,
};

export interface Storage {
  presignUpload(key: string, contentType: string): Promise<string>;
  presignRead(key: string): Promise<string>;
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;
}

export const r2Storage: Storage = {
  async presignUpload(key, contentType) {
    return getSignedUrl(
      await s3(),
      new PutObjectCommand({ Bucket: env.r2Bucket, Key: key, ContentType: contentType }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );
  },
  async presignRead(key) {
    return getSignedUrl(await s3(), new GetObjectCommand({ Bucket: env.r2Bucket, Key: key }), {
      expiresIn: READ_URL_TTL_SECONDS,
    });
  },
  async put(key, body, contentType) {
    await (await s3()).send(
      new PutObjectCommand({ Bucket: env.r2Bucket, Key: key, Body: body, ContentType: contentType }),
    );
  },
  async deleteMany(keys) {
    if (keys.length === 0) return;
    await (await s3()).send(
      new DeleteObjectsCommand({
        Bucket: env.r2Bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  },
};
