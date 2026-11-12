import type { JewelryDetail } from "@jewelry/core";
import { emptyComponent, emptyCost, emptyPiece, emptyStone, fromDetail, toDraft, validate } from "../form";

const units = { lengthUnit: "in", ringSizeSystem: "us" } as const;

describe("jewelry form", () => {
  it("converts user units to stored values", () => {
    const f = emptyPiece();
    f.description = "Solitaire ring";
    f.weightG = "3.25";
    f.components[0] = { ...emptyComponent("ring"), ringSize: "7", widthMm: "2" };
    f.components.push({ ...emptyComponent("chain"), length: "18", style: "cable" });
    f.costs = [{ ...emptyCost("casting"), unitCost: "1,250.50", workerName: "Mang Jun" }];

    const d = toDraft(f, units);
    expect(d.weightG).toBe(3.25);
    expect(d.components[0]!.ringSizeMm).toBeCloseTo(17.32, 2);
    expect(d.components[0]!.metal).toBeNull(); // shared metal lives on the piece
    expect(d.components[1]!.lengthMm).toBeCloseTo(457.2, 1);
    expect(d.components[1]!.ringSizeMm).toBeNull();
    expect(d.costs[0]!.unitCost).toBe(125050);
    expect(d.costs[0]!.workerName).toBe("Mang Jun");
  });

  it("drops measurements that do not apply to the part type", () => {
    const f = emptyPiece();
    f.description = "Studs";
    f.components[0] = { ...emptyComponent("earrings"), ringSize: "7", earringBack: "push_back" as never };
    const d = toDraft(f, units);
    expect(d.components[0]!.ringSizeMm).toBeNull();
  });

  it("keeps metal per part when parts differ", () => {
    const f = emptyPiece();
    f.description = "Two-tone set";
    f.sameMetalForAll = false;
    f.components[0] = { ...emptyComponent("ring"), metal: "gold", purity: "14K", weightG: "2" };
    const d = toDraft(f, units);
    expect(d.metal).toBeNull();
    expect(d.components[0]).toMatchObject({ metal: "gold", purity: "14K", weightG: 2 });
  });

  it("round-trips a saved piece back into the form", () => {
    const f = emptyPiece();
    f.description = "Ring";
    f.components[0] = { ...emptyComponent("ring"), ringSize: "6.5", stones: [{ ...emptyStone(), quantity: "3", totalCarat: "0.15" }] };
    const draft = toDraft(f, units);
    const now = "2026-01-01T00:00:00.000Z";
    const meta = { createdAt: now, updatedAt: now, deletedAt: null, archivedAt: null, purgedAt: null };
    const detail = {
      jewelry: { id: "j1", code: "JW-00001", ...meta, ...draft, components: undefined },
      pieceType: "ring",
      components: draft.components.map((c, i) => ({
        ...meta,
        ...c,
        id: `c${i}`,
        jewelryId: "j1",
        sortOrder: i,
        stones: c.stones.map((s, k) => ({ ...meta, ...s, id: `s${k}`, componentId: `c${i}` })),
      })),
      costs: [],
      images: [],
      totalCost: 0,
      totalWeightG: null,
      order: null,
    } as unknown as JewelryDetail;

    const back = fromDetail(detail, units);
    expect(back.components[0]!.ringSize).toBe("6.5");
    expect(back.components[0]!.stones[0]).toMatchObject({ quantity: "3", totalCarat: "0.15" });
  });

  it("reports fixable problems with field paths", () => {
    const f = emptyPiece();
    f.components[0] = { ...emptyComponent("ring"), ringSize: "abc", stones: [{ ...emptyStone(), quantity: "1.5" }] };
    f.costs = [{ ...emptyCost(), unitCost: "" }];
    const e = validate(f);
    expect(e.description).toBeDefined();
    expect(e["components.0.ringSize"]).toBe("Enter a valid number");
    expect(e["components.0.stones.0.quantity"]).toBe("Enter a whole number");
    expect(e["costs.0.unitCost"]).toBeDefined();
  });
});
