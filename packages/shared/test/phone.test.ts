import { describe, expect, it } from "vitest";
import { formatPhPhone, parsePhPhone } from "../src/phone";

describe("parsePhPhone", () => {
  it.each([
    ["09171234567", "+639171234567"],
    ["0917 123 4567", "+639171234567"],
    ["0917-123-4567", "+639171234567"],
    ["+63 917 123 4567", "+639171234567"],
    ["639171234567", "+639171234567"],
  ])("normalizes mobile %s", (input, e164) => {
    expect(parsePhPhone(input)).toEqual({ e164, kind: "mobile" });
  });

  it.each([
    ["(02) 8123 4567", "+63281234567"],
    ["02-8123-4567", "+63281234567"],
    ["+63 2 8123 4567", "+63281234567"],
    ["(032) 123 4567", "+63321234567"],
    ["074 123 4567", "+63741234567"],
  ])("normalizes landline %s", (input, e164) => {
    expect(parsePhPhone(input)).toEqual({ e164, kind: "landline" });
  });

  it.each(["", "12345", "0917123456", "091712345678", "+1 415 555 0100", "0917abc4567", "(01) 1234 5678"])(
    "rejects %s",
    (input) => {
      expect(parsePhPhone(input)).toBeNull();
    },
  );
});

describe("formatPhPhone", () => {
  it("formats each kind locally", () => {
    expect(formatPhPhone("+639171234567")).toBe("0917 123 4567");
    expect(formatPhPhone("+63281234567")).toBe("(02) 8123 4567");
    expect(formatPhPhone("+63321234567")).toBe("(032) 123 4567");
  });

  it("returns unknown input unchanged", () => {
    expect(formatPhPhone("n/a")).toBe("n/a");
  });
});
