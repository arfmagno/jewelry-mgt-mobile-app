import type { PIECE_TYPES } from "./enums";
import { lineTotal } from "./money";
import type { JewelryComponent, JewelryCost, JewelryStone } from "./records";

export type PieceType = (typeof PIECE_TYPES.values)[number];

/** One component → its type; exactly chain + pendant → necklace; anything else → set. */
export function pieceType(componentTypes: readonly JewelryComponent["type"][]): PieceType | null {
  if (componentTypes.length === 0) return null;
  if (componentTypes.length === 1) return componentTypes[0]!;
  const sorted = [...componentTypes].sort();
  if (sorted.length === 2 && sorted[0] === "chain" && sorted[1] === "pendant") return "necklace";
  return "set";
}

export function costTotal(costs: readonly Pick<JewelryCost, "quantity" | "unitCost">[]): number {
  return costs.reduce((sum, c) => sum + lineTotal(c.quantity, c.unitCost), 0);
}

/** Stones are priced per stone; unpriced stones add nothing. */
export function stoneTotal(stones: readonly Pick<JewelryStone, "quantity" | "unitCost">[]): number {
  return stones.reduce((sum, s) => sum + s.quantity * (s.unitCost ?? 0), 0);
}

export function suggestedPrice(costMinor: number, markupPct: number): number {
  return Math.round(costMinor * (1 + markupPct / 100));
}

export type OrderTotals = {
  cost: number;
  selling: number;
  profit: number;
  /** Profit as a fraction of selling price; null when nothing is sold yet. */
  margin: number | null;
  paid: number;
  balance: number;
};

export function orderTotals(
  items: readonly { cost: number; sellingPrice: number }[],
  payments: readonly { amount: number }[],
): OrderTotals {
  const cost = items.reduce((s, i) => s + i.cost, 0);
  const selling = items.reduce((s, i) => s + i.sellingPrice, 0);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const profit = selling - cost;
  return {
    cost,
    selling,
    profit,
    margin: selling > 0 ? profit / selling : null,
    paid,
    balance: selling - paid,
  };
}

/** Total metal weight: the piece's weight when all parts share one metal, else the sum of parts. */
export function totalWeight(
  piece: { sameMetalForAll: boolean; weightG: number | null },
  components: readonly { weightG: number | null }[],
): number | null {
  if (piece.sameMetalForAll) return piece.weightG;
  const weights = components.map((c) => c.weightG).filter((w): w is number => w != null);
  return weights.length ? weights.reduce((a, b) => a + b, 0) : null;
}
