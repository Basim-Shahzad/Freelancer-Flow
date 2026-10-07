import { describe, expect, it } from "vitest";
import { amountParts, formatAmount, formatMoney, parseAmount, parseDuration } from "./money";
import { convertMinor } from "./fx";

describe("money", () => {
  it("formats USD with 2 decimals and PKR with none", () => {
    expect(formatAmount(125000, "USD")).toBe("1,250.00");
    expect(formatMoney(18500000, "PKR")).toBe("PKR 185,000");
  });
  it("splits parts", () => {
    expect(amountParts(125000, "USD")).toEqual({ int: "1,250", dec: ".00" });
    expect(amountParts(18500000, "PKR")).toEqual({ int: "185,000", dec: "" });
  });
  it("parses amounts", () => {
    expect(parseAmount("1,250.5")).toBe(125050);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });
  it("parses durations", () => {
    expect(parseDuration("1.5")).toBe(90);
    expect(parseDuration("1:30")).toBe(90);
    expect(parseDuration("90m")).toBe(90);
    expect(parseDuration("1h 30m")).toBe(90);
    expect(parseDuration("nope")).toBeNull();
  });
  it("converts at the reference rate", () => {
    expect(convertMinor(125000, "USD", "PKR")).toBe(34825000);
    expect(convertMinor(100, "USD", "USD")).toBe(100);
  });
});
