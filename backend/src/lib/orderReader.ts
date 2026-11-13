import { emptyIntent, METAL_COLORS, METALS, orderIntentSchema, PAYMENT_METHODS, PIECE_TYPES, type OrderIntent } from "@jewelry/shared";
import { runWorkersAi } from "./ai";
import { HttpError } from "./http";

/** Reads a shop owner's message about an order into structured fields. Swappable like DesignGenerator. */
export interface OrderReader {
  readonly model: string;
  read(message: string, today: string): Promise<OrderIntent>;
}

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });
const str = nullable({ type: "string" });
const num = nullable({ type: "number" });
const oneOf = (values: readonly string[]) => nullable({ type: "string", enum: values });

/** JSON schema the model must answer in; mirrors orderIntentSchema. */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    clientName: str,
    clientPhone: str,
    pieces: {
      type: "array",
      items: {
        type: "object",
        properties: {
          code: str,
          description: str,
          type: oneOf(PIECE_TYPES.values),
          metal: oneOf(METALS.values),
          purity: str,
          metalColor: oneOf(METAL_COLORS.values),
          price: num,
        },
        required: ["code", "description", "type", "metal", "purity", "metalColor", "price"],
      },
    },
    downPayment: num,
    paymentMethod: oneOf(PAYMENT_METHODS.values),
    notes: str,
  },
  required: ["clientName", "clientPhone", "pieces", "downPayment", "paymentMethod", "notes"],
} as const;

const SYSTEM_PROMPT = `You read short notes from a jewelry shop owner in the Philippines about a client's order.
The note may mix English and Filipino. Extract only what is said; use null for anything not stated. Never invent values.
- clientName: the client's name as written.
- clientPhone: a Philippine mobile number if given.
- pieces: one entry per piece. code is a piece code like "JW-00012". description is the piece in the owner's words
  without the client, price or payment ("18K white gold ring with a 3mm diamond"). purity is a karat like "18K" or a
  silver fineness like "925". "18K" is a karat, not a price.
- price: the selling price of that piece in whole pesos ("18k pesos", "₱18,000" and "18,000" are 18000).
- downPayment: amount paid now in pesos ("5k down", "dp 5000"). 0 if they say there is none.
- paymentMethod: how the down payment was paid.
- notes: a due date, engraving or other instruction, as a short phrase. Today is {today}.`;

export const workersAiOrderReader: OrderReader = {
  model: MODEL,
  async read(message, today) {
    const result = await runWorkersAi<{ response?: unknown }>(MODEL, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT.replace("{today}", today) },
        { role: "user", content: message },
      ],
      response_format: { type: "json_schema", json_schema: RESPONSE_SCHEMA },
      max_tokens: 400,
      temperature: 0,
    });
    return parseIntent(result.response);
  },
};

/** Accepts the model's answer as an object or JSON text; anything unusable becomes null. */
export function parseIntent(response: unknown): OrderIntent {
  let value = response;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      throw new HttpError(502, "ai_error", "The AI provider returned an unreadable answer");
    }
  }
  if (!value || typeof value !== "object") return emptyIntent();
  return orderIntentSchema.parse(value);
}
