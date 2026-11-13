import { CreateTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { AddressInfo } from "node:net";
import { createHandler, type Deps } from "../src/handler";
import { emptyIntent } from "@jewelry/shared";
import type { DesignGenerator } from "../src/lib/ai";
import type { OrderReader } from "../src/lib/orderReader";
import { HttpError } from "../src/lib/http";
import { createDynamoRepo, type RecordRepo, type StoredRecord } from "../src/lib/records";
import type { Storage } from "../src/lib/storage";

/** Test doubles and helpers, also used by cross-package integration tests. */

export function memoryRepo(): RecordRepo & { items: Map<string, StoredRecord> } {
  const items = new Map<string, StoredRecord>();
  const counters = new Map<string, number>();
  const key = (u: string, t: string, id: string) => `${u}|${t}|${id}`;
  return {
    items,
    async get(u, t, id) {
      return items.get(key(u, t, id)) ?? null;
    },
    async put(u, rec, expected) {
      const k = key(u, rec.table, rec.id);
      const current = items.get(k);
      if ((current?.serverUpdatedAt ?? null) !== expected) return false;
      items.set(k, rec);
      return true;
    },
    async nextCode(u, t) {
      const n = (counters.get(`${u}|${t}`) ?? 0) + 1;
      counters.set(`${u}|${t}`, n);
      return n;
    },
    async reserveCode(u, t, n) {
      counters.set(`${u}|${t}`, Math.max(counters.get(`${u}|${t}`) ?? 0, n));
    },
    async changesSince(u, { since, cursor, limit }) {
      const all = [...items.entries()]
        .filter(([k, r]) => k.startsWith(`${u}|`) && (!since || r.serverUpdatedAt > since))
        .map(([, r]) => r)
        .sort((a, b) => `${a.serverUpdatedAt}#${a.table}#${a.id}`.localeCompare(`${b.serverUpdatedAt}#${b.table}#${b.id}`));
      const start = cursor ? Number(cursor) : 0;
      const page = all.slice(start, start + limit);
      return { records: page, nextCursor: start + limit < all.length ? String(start + limit) : null };
    },
  };
}

export function fakeStorage(): Storage & { deleted: string[] } {
  const deleted: string[] = [];
  return {
    deleted,
    async presignUpload(key) {
      return `https://r2.test/upload/${key}`;
    },
    async presignRead(key) {
      return `https://r2.test/read/${key}`;
    },
    async put() {},
    async deleteMany(keys) {
      deleted.push(...keys);
    },
  };
}

export const fakeAi: DesignGenerator = {
  model: "test-model",
  async enhancePrompt(d) {
    return `enhanced: ${d}`;
  },
  basicPrompt: (d) => `basic: ${d}`,
  async generateImage() {
    return new Uint8Array([0xff, 0xd8, 0xff]);
  },
};

/** Echoes the message back as the client's name, so routing can be checked without a model. */
export const fakeOrderReader: OrderReader = {
  model: "test-reader",
  async read(message) {
    return { ...emptyIntent(), clientName: message };
  },
};

/** Accepts "Bearer user-<id>" as the user id. */
export async function fakeAuth(header: string | undefined): Promise<string> {
  const m = header?.match(/^Bearer user-(.+)$/);
  if (!m) throw new HttpError(401, "unauthorized", "Missing bearer token");
  return m[1]!;
}

export function testHandler(over: Partial<Deps> = {}) {
  let t = Date.parse("2026-03-01T00:00:00.000Z");
  const deps: Deps = {
    repo: memoryRepo(),
    storage: fakeStorage(),
    ai: fakeAi,
    orderReader: fakeOrderReader,
    authenticate: fakeAuth,
    now: () => new Date(t++),
    ...over,
  };
  return { handler: createHandler(deps), deps };
}

export function event(
  method: string,
  path: string,
  opts: { body?: unknown; query?: Record<string, string>; user?: string | null } = {},
): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: path,
    rawQueryString: "",
    headers: opts.user === null ? {} : { authorization: `Bearer user-${opts.user ?? "u1"}` },
    queryStringParameters: opts.query,
    requestContext: { http: { method, path } } as APIGatewayProxyEventV2["requestContext"],
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    isBase64Encoded: false,
  };
}

export async function call<T = unknown>(
  handler: ReturnType<typeof createHandler>,
  ev: APIGatewayProxyEventV2,
): Promise<{ status: number; body: T }> {
  const res = (await handler(ev)) as { statusCode: number; body: string };
  return { status: res.statusCode, body: res.body ? (JSON.parse(res.body) as T) : (undefined as T) };
}

/** Starts an in-process DynamoDB (dynalite) with the production table layout. */
export async function startDynamo(tableName = "jewelry-test") {
  const moduleName = "dynalite"; // untyped dev dependency
  const dynalite = ((await import(moduleName)) as { default: unknown }).default as (o: object) => {
    listen(port: number, cb: (err?: Error) => void): void;
    address(): AddressInfo;
    close(cb: () => void): void;
  };
  const server = dynalite({ createTableMs: 0, updateTableMs: 0, deleteTableMs: 0 });
  await new Promise<void>((resolve, reject) => server.listen(0, (err) => (err ? reject(err) : resolve())));
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  const raw = new DynamoDBClient({
    endpoint,
    region: "local",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });
  await raw.send(
    new CreateTableCommand({
      TableName: tableName,
      BillingMode: "PROVISIONED",
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      AttributeDefinitions: [
        { AttributeName: "PK", AttributeType: "S" },
        { AttributeName: "SK", AttributeType: "S" },
        { AttributeName: "GSI1PK", AttributeType: "S" },
        { AttributeName: "GSI1SK", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "PK", KeyType: "HASH" },
        { AttributeName: "SK", KeyType: "RANGE" },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "GSI1",
          KeySchema: [
            { AttributeName: "GSI1PK", KeyType: "HASH" },
            { AttributeName: "GSI1SK", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
          ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
        },
      ],
    }),
  );
  const doc = DynamoDBDocumentClient.from(raw, { marshallOptions: { removeUndefinedValues: true } });
  return {
    repo: createDynamoRepo(tableName, doc),
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
