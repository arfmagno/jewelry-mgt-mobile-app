import { describe, expect, it } from "vitest";
import { costTotal, orderTotals, pieceType, suggestedPrice, totalWeight } from "../src/domain";
import { parseRecord } from "../src/records";

describe("pieceType", () => {
  it("derives the display type from components", () => {
    expect(pieceType([])).toBeNull();
    expect(pieceType(["ring"])).toBe("ring");
    expect(pieceType(["pendant", "chain"])).toBe("necklace");
    expect(pieceType(["ring", "earrings"])).toBe("set");
    expect(pieceType(["chain", "pendant", "earrings"])).toBe("set");
  });
});

describe("costs and pricing", () => {
  it("sums cost lines", () => {
    expect(
      costTotal([
        { quantity: 3.2, unitCost: 400000 },
        { quantity: 1, unitCost: 50000 },
      ]),
    ).toBe(1330000);
  });

  it("applies markup", () => {
    expect(suggestedPrice(1000000, 30)).toBe(1300000);
  });

  it("computes order totals, profit and balance", () => {
    const t = orderTotals(
      [
        { cost: 1000000, sellingPrice: 1500000 },
        { cost: 200000, sellingPrice: 300000 },
      ],
      [{ amount: 500000 }],
    );
    expect(t).toEqual({
      cost: 1200000,
      selling: 1800000,
      profit: 600000,
      margin: 600000 / 1800000,
      paid: 500000,
      balance: 1300000,
    });
    expect(orderTotals([], []).margin).toBeNull();
  });

  it("totals weight per piece or per component", () => {
    expect(totalWeight({ sameMetalForAll: true, weightG: 7.4 }, [{ weightG: 1 }])).toBe(7.4);
    expect(
      totalWeight({ sameMetalForAll: false, weightG: null }, [{ weightG: 5.1 }, { weightG: 2.3 }]),
    ).toBeCloseTo(7.4);
    expect(totalWeight({ sameMetalForAll: false, weightG: null }, [{ weightG: null }])).toBeNull();
  });
});

describe("parseRecord", () => {
  const meta = {
    id: "01JC000000000000000000CLNT",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    archivedAt: null,
    purgedAt: null,
  };

  it("validates and normalizes a client", () => {
    const rec = parseRecord("clients", {
      ...meta,
      firstName: " Ana ",
      lastName: "Cruz",
      phone: "0917 123 4567",
      address: null,
      notes: null,
    });
    expect(rec.firstName).toBe("Ana");
    expect(rec.phone).toBe("+639171234567");
  });

  it("rejects invalid fields", () => {
    expect(() =>
      parseRecord("clients", { ...meta, firstName: "", lastName: "Cruz", phone: "123", address: null, notes: null }),
    ).toThrow();
  });

  it("accepts tombstones without field data", () => {
    const rec = parseRecord("clients", { ...meta, purgedAt: "2026-02-01T00:00:00.000Z" });
    expect(rec.purgedAt).toBe("2026-02-01T00:00:00.000Z");
    expect("firstName" in rec).toBe(false);
  });
});
