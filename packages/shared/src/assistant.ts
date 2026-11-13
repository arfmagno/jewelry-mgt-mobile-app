import { z } from "zod";
import { METAL_COLORS, METALS, PAYMENT_METHODS, PIECE_TYPES } from "./enums";

/**
 * What a message describing an order says, before it is matched against the
 * records on the phone. Produced by the AI model when online and by a rule-based
 * reader on the device otherwise. Amounts are whole pesos as said, not centavos.
 */
const text = (max: number) => z.string().trim().max(max).nullable().catch(null).default(null);
const pesos = z.number().min(0).max(10_000_000_000).nullable().catch(null).default(null);
const oneOf = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values).nullable().catch(null).default(null);

export const orderIntentPieceSchema = z.object({
  /** A piece code such as JW-00012. */
  code: text(20),
  /** The piece in the speaker's words, e.g. "18K white gold ring with a 3mm diamond". */
  description: text(300),
  type: oneOf(PIECE_TYPES.values),
  metal: oneOf(METALS.values),
  /** Karat or fineness, e.g. "18K" or "925". */
  purity: text(10),
  metalColor: oneOf(METAL_COLORS.values),
  price: pesos,
});

export const orderIntentSchema = z.object({
  clientName: text(120),
  clientPhone: text(30),
  pieces: z.array(orderIntentPieceSchema).max(10).catch([]).default([]),
  downPayment: pesos,
  paymentMethod: oneOf(PAYMENT_METHODS.values),
  /** Anything else worth keeping on the order, such as a due date or engraving. */
  notes: text(500),
});
export type OrderIntentPiece = z.infer<typeof orderIntentPieceSchema>;
export type OrderIntent = z.infer<typeof orderIntentSchema>;

export const emptyIntent = (): OrderIntent => orderIntentSchema.parse({});

/** POST /assistant/order: read a message about an order into an OrderIntent. */
export const interpretOrderSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  /** The phone's date, so "today" and "next Friday" can be read. */
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type InterpretOrderRequest = z.input<typeof interpretOrderSchema>;
export type InterpretOrderResponse = { intent: OrderIntent; model: string };
