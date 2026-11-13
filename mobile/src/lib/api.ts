import type { SyncTransport, UploadTransport } from "@jewelry/core";
import type {
  ApiErrorBody,
  GenerateDesignRequest,
  GenerateDesignResponse,
  ImageUrlsResponse,
  InterpretOrderRequest,
  InterpretOrderResponse,
  PullResponse,
  PushRequest,
  PushResponse,
  UploadRequest,
  UploadResponse,
} from "@jewelry/shared";
import { File } from "expo-file-system";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export type ApiClient = SyncTransport &
  UploadTransport & {
    imageUrls(keys: string[]): Promise<ImageUrlsResponse>;
    generateDesign(body: GenerateDesignRequest): Promise<GenerateDesignResponse>;
    interpretOrder(body: InterpretOrderRequest): Promise<InterpretOrderResponse>;
  };

type Deps = {
  baseUrl: string;
  getToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
  putFile?: UploadTransport["putFile"];
};

/** Uploads a local file straight to a presigned URL (the body never passes through JS memory). */
async function nativePut(uploadUrl: string, localUri: string, contentType: string): Promise<void> {
  const res = await new File(localUri).upload(uploadUrl, {
    httpMethod: "PUT",
    headers: { "Content-Type": contentType },
    mimeType: contentType,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new ApiError(res.status, "upload_failed", "Photo upload failed.");
  }
}

export function createApiClient({ baseUrl, getToken, fetchImpl = fetch, putFile = nativePut }: Deps): ApiClient {
  async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const token = await getToken();
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, "network", "You appear to be offline.");
    }
    const json = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      const err = (json as ApiErrorBody | null)?.error;
      throw new ApiError(res.status, err?.code ?? "http_error", err?.message ?? `Request failed (${res.status}).`);
    }
    return json as T;
  }

  return {
    push: (body: PushRequest) => request<PushResponse>("POST", "/sync/push", body),
    pull: (q) => {
      const params = new URLSearchParams();
      if (q.since) params.set("since", q.since);
      if (q.cursor) params.set("cursor", q.cursor);
      if (q.limit) params.set("limit", String(q.limit));
      const qs = params.toString();
      return request<PullResponse>("GET", `/sync/pull${qs ? `?${qs}` : ""}`);
    },
    requestUpload: (body: UploadRequest) => request<UploadResponse>("POST", "/uploads", body),
    putFile,
    imageUrls: (keys) => request<ImageUrlsResponse>("POST", "/images/urls", { keys }),
    generateDesign: (body) => request<GenerateDesignResponse>("POST", "/designs/generate", body),
    interpretOrder: (body) => request<InterpretOrderResponse>("POST", "/assistant/order", body),
  };
}
