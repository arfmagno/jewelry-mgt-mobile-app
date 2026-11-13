import { describe, expect, it } from "vitest";
import { findAmounts, readOrderMessage } from "../src/reader";

describe("readOrderMessage", () => {
  it("reads a typical order note", () => {
    const i = readOrderMessage("Maria Santos wants an 18K white gold ring with a 3mm diamond, ₱18,000, ₱5,000 down via GCash. Due Dec 20");
    expect(i.clientName).toBe("Maria Santos");
    expect(i.pieces).toHaveLength(1);
    expect(i.pieces[0]).toMatchObject({
      description: "18K white gold ring with a 3mm diamond",
      type: "ring",
      metal: "gold",
      purity: "18K",
      metalColor: "white",
      price: 18000,
    });
    expect(i.downPayment).toBe(5000);
    expect(i.paymentMethod).toBe("gcash");
    expect(i.notes).toBe("Due Dec 20");
  });

  it("tells karats from thousands of pesos", () => {
    expect(findAmounts("18K gold ring").map((a) => a.pesos)).toEqual([]);
    expect(findAmounts("18k gold ring for 25k, 5k down").map((a) => a.pesos)).toEqual([25000, 5000]);
    expect(findAmounts("₱18k").map((a) => a.pesos)).toEqual([18000]);
  });

  it("ignores sizes, weights, years and phone numbers", () => {
    expect(findAmounts("3mm stone, 2.5 g, 2026, 0917 123 4567").map((a) => a.pesos)).toEqual([]);
  });

  it("reads codes, several pieces, a phone number and a client after 'for'", () => {
    const i = readOrderMessage("Order for Ana Cruz 09171234567: JW-12 and JW-00040");
    expect(i.clientName).toBe("Ana Cruz");
    expect(i.clientPhone).toBe("09171234567");
    expect(i.pieces.map((p) => p.code)).toEqual(["JW-00012", "JW-00040"]);
  });

  it("splits two pieces and their prices", () => {
    const i = readOrderMessage("For Liza Reyes: silver pendant 3,500 and 14K gold earrings 9,800, 2000 dp cash");
    expect(i.pieces.map((p) => [p.type, p.price])).toEqual([
      ["pendant", 3500],
      ["earrings", 9800],
    ]);
    expect(i.pieces[0]?.metal).toBe("silver");
    expect(i.downPayment).toBe(2000);
    expect(i.paymentMethod).toBe("cash");
  });

  it("keeps a chain that comes with a pendant as one piece", () => {
    const i = readOrderMessage("18K gold pendant with chain for Jun Lim");
    expect(i.pieces).toHaveLength(1);
    expect(i.pieces[0]?.description).toBe("18K gold pendant with chain");
    expect(i.clientName).toBe("Jun Lim");
  });

  it("returns nothing it can't find", () => {
    const i = readOrderMessage("hello");
    expect(i).toMatchObject({ clientName: null, clientPhone: null, pieces: [], downPayment: null, paymentMethod: null, notes: null });
  });
});

describe("findAmounts", () => {
  it("reads a round amount that looks like a year, but not a date's year", () => {
    expect(findAmounts("2000 dp").map((a) => a.pesos)).toEqual([2000]);
    expect(findAmounts("due Dec 20, 2026").map((a) => a.pesos)).toEqual([]);
  });
});
