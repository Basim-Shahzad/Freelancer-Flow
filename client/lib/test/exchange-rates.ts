import type { ExchangeRatesResponse } from "@/lib/api/exchange-rates.types";
import { toFxRates } from "@/lib/api/mappers/exchange-rates";

/** A `GET /reference/exchange-rates` response (USD base, PKR 278.6). */
export function exchangeRatesFixture(overrides: Partial<ExchangeRatesResponse> = {}): ExchangeRatesResponse {
  return { base: "USD", rates: { PKR: "278.6000" }, asOf: "2026-10-20", source: "State Bank of Pakistan", ...overrides };
}

export const fxRatesFixture = (overrides: Partial<ExchangeRatesResponse> = {}) => toFxRates(exchangeRatesFixture(overrides));

/** A rates table whose base is not USD (1 EUR = 1.087 USD = 303 PKR), to exercise the base-agnostic maths. */
export const eurBaseFixture = (): ExchangeRatesResponse => exchangeRatesFixture({ base: "EUR", rates: { USD: "1.087", PKR: "303.0" } });
