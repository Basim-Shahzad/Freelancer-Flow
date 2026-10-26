import { describe, expect, it } from "vitest";
import { toFxRates } from "@/lib/api/mappers/exchange-rates";
import { eurBaseFixture, fxRatesFixture } from "@/lib/test/exchange-rates";
import { convertForDisplay, counterpartOf } from "./fx";

const usd = fxRatesFixture(); // 1 USD = 278.6 PKR

describe("convertForDisplay", () => {
  it("converts USD to PKR with the direct rate (PKR has no decimals)", () => {
    expect(convertForDisplay(125000, "USD", "PKR", usd)).toEqual({ amount: 348250, asOf: "2026-10-20", source: "State Bank of Pakistan" });
  });

  it("converts PKR to USD with the inverse rate", () => {
    expect(convertForDisplay(348250, "PKR", "USD", usd)?.amount).toBe(125000);
    expect(convertForDisplay(278, "PKR", "USD", usd)?.amount).toBe(100); // 0.9978 USD -> 99.78 cents
  });

  it("rounds half away from zero, for negatives too", () => {
    const half = fxRatesFixture({ rates: { PKR: "50" } }); // 1 cent = 0.5 rupee
    expect(convertForDisplay(1, "USD", "PKR", half)?.amount).toBe(1);
    expect(convertForDisplay(-1, "USD", "PKR", half)?.amount).toBe(-1);
    expect(convertForDisplay(3, "USD", "PKR", half)?.amount).toBe(2); // 1.5 -> 2
    expect(convertForDisplay(2, "USD", "PKR", half)?.amount).toBe(1);
  });

  it("goes through a non-USD base for both directions", () => {
    const eur = toFxRates(eurBaseFixture()); // 1 EUR = 1.087 USD = 303 PKR
    // 1 USD = 303 / 1.087 = 278.749... PKR
    expect(convertForDisplay(100000, "USD", "PKR", eur)?.amount).toBe(278749);
    expect(convertForDisplay(278749, "PKR", "USD", eur)?.amount).toBe(100000);
  });

  it("returns null when a rate is missing", () => {
    expect(convertForDisplay(100, "USD", "PKR", fxRatesFixture({ rates: {} }))).toBeNull();
    expect(convertForDisplay(100, "PKR", "USD", fxRatesFixture({ rates: {} }))).toBeNull();
    expect(convertForDisplay(100, "USD", "PKR", null)).toBeNull();
  });

  it("returns null for unparsable or non-positive rates", () => {
    expect(convertForDisplay(100, "USD", "PKR", { ...usd, rates: { PKR: "abc" } })).toBeNull();
    expect(convertForDisplay(100, "USD", "PKR", { ...usd, rates: { PKR: "0" } })).toBeNull();
    expect(convertForDisplay(100, "USD", "PKR", { ...usd, rates: { PKR: "-5" } })).toBeNull();
  });

  it("shows nothing for unsupported pairs and equal currencies", () => {
    const all = fxRatesFixture({ rates: { PKR: "278.6", EUR: "0.92", GBP: "0.78", AED: "3.6725" } });
    expect(convertForDisplay(100, "EUR", "PKR", all)).toBeNull();
    expect(convertForDisplay(100, "PKR", "EUR", all)).toBeNull();
    expect(convertForDisplay(100, "EUR", "USD", all)).toBeNull();
    expect(convertForDisplay(100, "USD", "AED", all)).toBeNull();
    expect(convertForDisplay(100, "USD", "USD", all)).toBeNull();
  });

  it("keeps the real, older asOf and a null asOf as null", () => {
    expect(convertForDisplay(100, "USD", "PKR", fxRatesFixture({ asOf: "2026-01-02" }))?.asOf).toBe("2026-01-02");
    expect(convertForDisplay(100, "USD", "PKR", fxRatesFixture({ asOf: null, source: null }))).toMatchObject({ asOf: null, source: null });
  });

  it("has no float drift on large amounts", () => {
    // 9,000,000,000.00 USD * 278.6 = 2,507,400,000,000 PKR exactly.
    expect(convertForDisplay(900000000000, "USD", "PKR", usd)?.amount).toBe(2507400000000);
    expect(convertForDisplay(1, "USD", "PKR", fxRatesFixture({ rates: { PKR: "278.6000" } }))?.amount).toBe(3);
  });
});

describe("counterpartOf", () => {
  it("pairs USD and PKR only", () => {
    expect(counterpartOf("USD")).toBe("PKR");
    expect(counterpartOf("PKR")).toBe("USD");
    expect(counterpartOf("EUR")).toBeUndefined();
  });
});
