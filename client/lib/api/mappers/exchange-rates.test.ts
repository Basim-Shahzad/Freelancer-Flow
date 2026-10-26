import { describe, expect, it } from "vitest";
import { exchangeRatesFixture } from "@/lib/test/exchange-rates";
import { portalRates, toFxRates } from "./exchange-rates";

describe("toFxRates", () => {
  it("upper-cases codes and keeps asOf and source", () => {
    expect(toFxRates(exchangeRatesFixture({ base: "usd", rates: { pkr: "278.6" } }))).toEqual({
      base: "USD", rates: { PKR: "278.6" }, asOf: "2026-10-20", source: "State Bank of Pakistan",
    });
  });

  it("drops zero, negative, empty and unparsable rates", () => {
    const r = toFxRates(exchangeRatesFixture({ rates: { PKR: "0", EUR: "-1", GBP: "", AED: "abc", USD: "1.0" } }));
    expect(r.rates).toEqual({ USD: "1.0" });
  });

  it("keeps a null asOf and source as null", () => {
    const r = toFxRates(exchangeRatesFixture({ asOf: null, source: null }));
    expect(r.asOf).toBeNull();
    expect(r.source).toBeNull();
  });
});

describe("portalRates", () => {
  it("is null when the invoice has no embedded block", () => {
    expect(portalRates(null)).toBeNull();
    expect(portalRates(undefined)).toBeNull();
  });
  it("maps the embedded block", () => {
    expect(portalRates(exchangeRatesFixture())?.rates.PKR).toBe("278.6000");
  });
});
