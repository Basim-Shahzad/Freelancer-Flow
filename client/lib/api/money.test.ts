import { describe, expect, it } from "vitest";
import { toDecimal, toMinor } from "./money";

describe("toMinor", () => {
  it.each([
    ["1250.50", "USD", 125050],
    ["0.07", "USD", 7],
    ["10", "USD", 1000],
    ["10.5", "EUR", 1050],
    ["0.00", "GBP", 0],
    ["-3.25", "AED", -325],
    ["185000.00", "PKR", 185000],
    ["185000", "PKR", 185000],
    ["19.99", "USD", 1999], // would be 1998.9999… with float math
    ["1.005", "USD", 101], // rounds half away from zero, no float error
    ["1.004", "USD", 100],
    ["90071992547409.91", "USD", 9007199254740991],
  ] as const)("%s %s -> %i", (input, cur, expected) => {
    expect(toMinor(input, cur)).toBe(expected);
  });

  it("accepts numbers", () => {
    expect(toMinor(12.3, "USD")).toBe(1230);
  });

  it("never returns -0", () => {
    expect(Object.is(toMinor("-0.00", "USD"), -0)).toBe(false);
  });

  it.each(["", "abc", "1,250.00", "1e3", "1.2.3"])("rejects %j", (bad) => {
    expect(() => toMinor(bad, "USD")).toThrow(RangeError);
  });

  it("rejects amounts beyond the safe integer range", () => {
    expect(() => toMinor("99999999999999999.99", "USD")).toThrow(RangeError);
  });
});

describe("toDecimal", () => {
  it.each([
    [125050, "USD", "1250.50"],
    [7, "USD", "0.07"],
    [0, "USD", "0.00"],
    [-325, "AED", "-3.25"],
    [185000, "PKR", "185000"],
    [-5, "PKR", "-5"],
  ] as const)("%i %s -> %s", (minor, cur, expected) => {
    expect(toDecimal(minor, cur)).toBe(expected);
  });

  it("rejects non-integers", () => {
    expect(() => toDecimal(1.5, "USD")).toThrow(RangeError);
  });

  it("round-trips", () => {
    for (const minor of [0, 1, 99, 100, 123456789, -42]) {
      expect(toMinor(toDecimal(minor, "USD"), "USD")).toBe(minor);
      expect(toMinor(toDecimal(minor, "PKR"), "PKR")).toBe(minor);
    }
  });
});
