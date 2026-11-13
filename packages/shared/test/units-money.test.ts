import { describe, expect, it } from "vitest";
import { formatMoney, lineTotal, moneyToInput, parseMoney } from "../src/money";
import {
  formatLength,
  formatRingSize,
  lengthToMm,
  mmToLength,
  nearestRingSize,
  RING_SIZES,
  ringSizeFromMm,
  ringSizeToMm,
} from "../src/units";

describe("lengths", () => {
  it("round-trips inches and centimetres through millimetres", () => {
    expect(mmToLength(lengthToMm(18, "in"), "in")).toBe(18);
    expect(mmToLength(lengthToMm(45, "cm"), "cm")).toBe(45);
  });

  it("formats with unit symbols", () => {
    expect(formatLength(457.2, "in")).toBe("18″");
    expect(formatLength(450, "cm")).toBe("45 cm");
  });
});

describe("ring sizes", () => {
  it("converts US sizes to the standard inner diameter", () => {
    expect(ringSizeToMm(7, "us")).toBeCloseTo(17.32, 2);
    expect(ringSizeFromMm(17.32, "us")).toBe(7);
    expect(ringSizeFromMm(ringSizeToMm(6.5, "us"), "us")).toBe(6.5);
  });

  it("lists picker sizes and snaps stored values to the nearest one", () => {
    expect(RING_SIZES.us[0]).toBe(3);
    expect(RING_SIZES.us.at(-1)).toBe(13);
    expect(RING_SIZES.us).toContain(6.5);
    expect(RING_SIZES.iso).toContain(52);
    expect(nearestRingSize(ringSizeToMm(6.3, "us"), "us")).toBe(6.5);
    expect(nearestRingSize(ringSizeToMm(7, "us"), "us")).toBe(7);
    expect(nearestRingSize(ringSizeToMm(52.4, "iso"), "iso")).toBe(52);
  });

  it("uses inner circumference for ISO", () => {
    expect(ringSizeFromMm(ringSizeToMm(54, "iso"), "iso")).toBe(54);
    expect(formatRingSize(ringSizeToMm(7, "us"), "us")).toBe("US 7");
  });
});

describe("money", () => {
  it("formats centavos as pesos", () => {
    expect(formatMoney(1250050)).toBe("₱12,500.50");
    expect(formatMoney(5)).toBe("₱0.05");
    expect(formatMoney(-100)).toBe("-₱1.00");
    expect(formatMoney(123456789)).toBe("₱1,234,567.89");
  });

  it("parses user input", () => {
    expect(parseMoney("12,500")).toBe(1250000);
    expect(parseMoney("₱12,500.5")).toBe(1250050);
    expect(parseMoney("0.05")).toBe(5);
    expect(parseMoney("12.345")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("")).toBeNull();
  });

  it("produces editable input text", () => {
    expect(moneyToInput(1250050)).toBe("12500.50");
    expect(moneyToInput(null)).toBe("");
  });

  it("rounds line totals to whole centavos", () => {
    expect(lineTotal(3.2, 400000)).toBe(1280000);
    expect(lineTotal(0.333, 100)).toBe(33);
  });
});
