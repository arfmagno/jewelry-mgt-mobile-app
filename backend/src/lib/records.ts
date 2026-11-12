import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { TableName } from "@jewelry/shared";
import { badRequest } from "./http";

/**
 * DynamoDB single-table layout (one partition per user):
 *
 *   PK            SK                     GSI1PK        GSI1SK
 *   USER#<sub>    REC#<table>#<id>       USER#<sub>    <serverUpdatedAt>#<table>#<id>
 *   USER#<sub>    COUNTER#<table>        -             -
 *
 * Records are stored whole in `data`; relational queries run on the device.
 * GSI1 orders every change by server time, which is what pull reads.
 */

export type StoredRecord = {
  table: TableName;
  id: string;
  updatedAt: string;
  serverUpdatedAt: string;
  data: Record<string, unknown>;
};

export interface RecordRepo {
  get(userId: string, table: TableName, id: string): Promise<StoredRecord | null>;
  /** Conditional write: fails (returns false) if the record changed since `expectedServerUpdatedAt`. */
  put(userId: string, rec: StoredRecord, expectedServerUpdatedAt: string | null): Promise<boolean>;
  nextCode(userId: string, table: TableName): Promise<number>;
  changesSince(
    userId: string,
    opts: { since?: string; cursor?: string; limit: number },
  ): Promise<{ records: StoredRecord[]; nextCursor: string | null }>;
}

const pk = (userId: string) => `USER#${userId}`;
const sk = (table: string, id: string) => `REC#${table}#${id}`;

export function createDynamoRepo(tableName: string, client?: DynamoDBDocumentClient): RecordRepo {
  const ddb =
    client ??
    DynamoDBDocumentClient.from(
      new DynamoDBClient(process.env.DYNAMODB_ENDPOINT ? { endpoint: process.env.DYNAMODB_ENDPOINT } : {}),
      { marshallOptions: { removeUndefinedValues: true } },
    );

  return {
    async get(userId, table, id) {
      const res = await ddb.send(
        new GetCommand({ TableName: tableName, Key: { PK: pk(userId), SK: sk(table, id) }, ConsistentRead: true }),
      );
      return res.Item ? toStored(res.Item) : null;
    },

    async put(userId, rec, expected) {
      try {
        await ddb.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              PK: pk(userId),
              SK: sk(rec.table, rec.id),
              GSI1PK: pk(userId),
              GSI1SK: `${rec.serverUpdatedAt}#${rec.table}#${rec.id}`,
              table: rec.table,
              id: rec.id,
              updatedAt: rec.updatedAt,
              serverUpdatedAt: rec.serverUpdatedAt,
              data: rec.data,
            },
            ConditionExpression: expected
              ? "serverUpdatedAt = :expected"
              : "attribute_not_exists(PK)",
            ExpressionAttributeValues: expected ? { ":expected": expected } : undefined,
          }),
        );
        return true;
      } catch (e) {
        if (e instanceof ConditionalCheckFailedException || (e as { name?: string }).name === "ConditionalCheckFailedException") {
          return false;
        }
        throw e;
      }
    },

    async nextCode(userId, table) {
      const res = await ddb.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { PK: pk(userId), SK: `COUNTER#${table}` },
          UpdateExpression: "ADD n :one",
          ExpressionAttributeValues: { ":one": 1 },
          ReturnValues: "UPDATED_NEW",
        }),
      );
      return Number(res.Attributes?.n);
    },

    async changesSince(userId, { since, cursor, limit }) {
      const res = await ddb.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: "GSI1",
          // "<since>#￿" sorts after every key stamped exactly at `since`, making the bound exclusive.
          KeyConditionExpression: since ? "GSI1PK = :pk AND GSI1SK > :since" : "GSI1PK = :pk",
          ExpressionAttributeValues: since
            ? { ":pk": pk(userId), ":since": `${since}#￿` }
            : { ":pk": pk(userId) },
          ExclusiveStartKey: decodeCursor(cursor, pk(userId)),
          Limit: limit,
        }),
      );
      return {
        records: (res.Items ?? []).map(toStored),
        nextCursor: res.LastEvaluatedKey ? encodeCursor(res.LastEvaluatedKey) : null,
      };
    },
  };
}

function toStored(item: Record<string, unknown>): StoredRecord {
  return {
    table: item.table as TableName,
    id: String(item.id),
    updatedAt: String(item.updatedAt),
    serverUpdatedAt: String(item.serverUpdatedAt),
    data: item.data as Record<string, unknown>,
  };
}

function encodeCursor(key: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(key), "utf8").toString("base64url");
}

/** Decodes a pull cursor and rejects any that points outside the caller's partition. */
function decodeCursor(cursor: string | undefined, partition: string): Record<string, unknown> | undefined {
  if (!cursor) return undefined;
  try {
    const key = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<string, unknown>;
    if (key.GSI1PK !== partition || key.PK !== partition) throw new Error();
    return key;
  } catch {
    throw badRequest("Invalid cursor");
  }
}
