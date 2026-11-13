import { interpretOrderSchema, type InterpretOrderResponse } from "@jewelry/shared";
import { json, type JsonResult } from "../lib/http";
import type { OrderReader } from "../lib/orderReader";

/** Reads a message about an order. Matching against clients and pieces happens on the phone, which holds the records. */
export async function interpretOrder(body: unknown, reader: OrderReader): Promise<JsonResult> {
  const { message, today } = interpretOrderSchema.parse(body);
  const response: InterpretOrderResponse = { intent: await reader.read(message, today), model: reader.model };
  return json(200, response);
}
