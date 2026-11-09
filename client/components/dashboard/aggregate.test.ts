import { describe, expect, it } from "vitest";
import { currencyEntries, estimateTarget } from "./aggregate";

describe("helpers", () => {
  it("currencyEntries drops zeros", () => expect(currencyEntries({ USD: 0, PKR: 5 })).toEqual([["PKR", 5]]));
  it("estimateTarget picks the other side", () => {
    expect(estimateTarget("USD", "USD")).toBe("PKR");
    expect(estimateTarget("PKR", "USD")).toBe("USD");
  });
});
