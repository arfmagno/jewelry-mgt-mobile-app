import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { workersAiGenerator, type DesignGenerator } from "./lib/ai";
import { authenticate } from "./lib/auth";
import { env } from "./lib/config";
import { errorResponse, json, parseJsonBody } from "./lib/http";
import { createDynamoRepo, type RecordRepo } from "./lib/records";
import { Router } from "./lib/router";
import { r2Storage, type Storage } from "./lib/storage";
import { createUpload, generateDesign, imageUrls } from "./routes/media";
import { pull, push } from "./routes/sync";

export type Deps = {
  repo: RecordRepo;
  storage: Storage;
  ai: DesignGenerator;
  authenticate: (authorization: string | undefined) => Promise<string>;
  now: () => Date;
};

/** Builds the single Lambda entry point behind the Function URL. */
export function createHandler(deps: Deps) {
  const router = new Router()
    .on("GET", "/health", async () => json(200, { ok: true }), { public: true })
    .on("POST", "/sync/push", ({ userId, body }) => push(userId, body, deps))
    .on("GET", "/sync/pull", ({ userId, query }) => pull(userId, query, deps))
    .on("POST", "/uploads", ({ userId, body }) => createUpload(userId, body, deps.storage))
    .on("POST", "/images/urls", ({ userId, body }) => imageUrls(userId, body, deps.storage))
    .on("POST", "/designs/generate", ({ body }) => generateDesign(body, deps.ai));

  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    try {
      const method = event.requestContext.http.method.toUpperCase();
      const { route, params } = router.match(method, event.rawPath);
      const userId = route.public ? "" : await deps.authenticate(event.headers?.authorization);
      return await route.handler({
        event,
        params,
        query: event.queryStringParameters ?? {},
        body: method === "GET" ? {} : parseJsonBody(event.body, event.isBase64Encoded),
        userId,
      });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

let defaultHandler: ReturnType<typeof createHandler> | undefined;

export const handler = (event: APIGatewayProxyEventV2) => {
  defaultHandler ??= createHandler({
    repo: createDynamoRepo(env.tableName),
    storage: r2Storage,
    ai: workersAiGenerator,
    authenticate,
    now: () => new Date(),
  });
  return defaultHandler(event);
};
