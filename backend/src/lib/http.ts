import type { APIGatewayProxyResultV2 } from "aws-lambda";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = "Resource") => new HttpError(404, "not_found", `${what} not found`);
export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, "bad_request", message, details);
export const conflict = (message: string) => new HttpError(409, "conflict", message);

export type JsonResult = { statusCode: number; headers: Record<string, string>; body: string };

export function json(status: number, body?: unknown): JsonResult {
  return {
    statusCode: status,
    headers: { "content-type": "application/json" },
    body: body === undefined ? "" : JSON.stringify(body),
  };
}

export function errorResponse(err: unknown): APIGatewayProxyResultV2 {
  if (err instanceof HttpError) {
    return json(err.status, { error: { code: err.code, message: err.message, details: err.details } });
  }
  if (isZodError(err)) {
    return json(400, {
      error: { code: "validation_error", message: "Invalid request", details: err.flatten() },
    });
  }
  console.error("Unhandled error", err);
  return json(500, { error: { code: "internal_error", message: "Something went wrong" } });
}

/** Structural check: workspace packages may each resolve their own copy of zod. */
export function isZodError(err: unknown): err is ZodError {
  return err instanceof ZodError || (err instanceof Error && err.name === "ZodError" && "flatten" in err);
}

export function parseJsonBody(body: string | undefined, isBase64Encoded?: boolean): unknown {
  if (!body) return {};
  const text = isBase64Encoded ? Buffer.from(body, "base64").toString("utf8") : body;
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest("Body must be valid JSON");
  }
}
