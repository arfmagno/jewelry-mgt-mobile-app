import type { JewelryDetail } from "@jewelry/core";
import {
  emptyComponent,
  emptyCost,
  emptyPiece,
  emptyStone,
  errorsForStep,
  formTotals,
  fromDetail,
  stepOfError,
  suggestDescription,
  toDraft,
  validate,
  withPartTypes,
} from "../form";

const units = { lengthUnit: "in", ringSizeSystem: "us" } as const;

describe("jewelry form", () => {
  it("converts user units to stored values", () => {
    const f = emptyPiece();
    f.description = "Solitaire ring";
    f.weightG = "3.25";
    f.components[0] = { ...emptyComponent("ring"), ringSize: "7", widthMm: "2" };
    f.components.push({ ...emptyComponent("chain"), length: "18", style: "cable" });
    f.costs = [{ ...emptyCost("labor"), unitCost: "1,250.50", description: "Setting" }];

    const d = toDraft(f, units);
    expect(d.weightG).toBe(3.25);
    expect(d.components[0]!.ringSizeMm).toBeCloseTo(17.32, 2);
    expect(d.components[0]!.metal).toBeNull(); // shared metal lives on the piece
    expect(d.components[1]!.lengthMm).toBeCloseTo(457.2, 1);
    expect(d.components[1]!.ringSizeMm).toBeNull();
    expect(d.costs[0]!.unitCost).toBe(125050);
    expect(d.costs[0]!.description).toBe("Setting");
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

  it("assigns each error to the step that shows the field", () => {
    expect(stepOfError("components")).toBe(0);
    expect(stepOfError("components.1.weightG")).toBe(1);
    expect(stepOfError("components.0.ringSize")).toBe(2);
    expect(stepOfError("components.0.stones.2.unitCost")).toBe(3);
    expect(stepOfError("costs.0.unitCost")).toBe(4);
    expect(stepOfError("description")).toBe(5);
    expect(errorsForStep({ description: "x", "costs.0.unitCost": "y" }, 4)).toEqual({ "costs.0.unitCost": "y" });
  });

  it("keeps details of parts whose type stays chosen", () => {
    const f = emptyPiece();
    f.components = [{ ...emptyComponent("ring"), ringSize: "7" }];
    const parts = withPartTypes(f, ["earrings", "ring"]);
    expect(parts.map((c) => c.type)).toEqual(["ring", "earrings"]);
    expect(parts[0]!.ringSize).toBe("7");
    expect(withPartTypes(f, ["earrings"]).map((c) => c.type)).toEqual(["earrings"]);
  });

  it("totals stones and cost lines as they are typed", () => {
    const f = emptyPiece();
    f.components = [{ ...emptyComponent("ring"), stones: [{ ...emptyStone(), quantity: "3", unitCost: "1,500" }, { ...emptyStone(), unitCost: "" }] }];
    f.costs = [{ ...emptyCost("metal"), quantity: "2.5", unitCost: "4000" }, { ...emptyCost("labor"), unitCost: "" }];
    expect(formTotals(f)).toEqual({ stones: 450_000, costs: 1_000_000, total: 1_450_000 });
  });

  it("suggests a description from the choices", () => {
    const f = emptyPiece();
    f.components = [{ ...emptyComponent("ring"), stones: [{ ...emptyStone(), quantity: "3" }] }];
    expect(suggestDescription(f)).toBe("18K yellow gold ring with 3 diamonds");
    f.metal = "silver";
    f.purity = "925";
    f.components = withPartTypes(f, ["chain", "pendant"]);
    expect(suggestDescription(f)).toBe("925 silver necklace");
    f.components = [{ ...emptyComponent("ring"), stones: [{ ...emptyStone(), stoneKind: "gemstone", gemName: "Ruby", quantity: "2" }] }, emptyComponent("earrings")];
    expect(suggestDescription(f)).toBe("925 silver ring and earrings set with 2 rubies");
  });
});
