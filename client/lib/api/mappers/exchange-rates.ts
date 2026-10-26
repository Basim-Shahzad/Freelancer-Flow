import type { ExchangeRatesResponse } from "@/lib/api/exchange-rates.types";

/** Reference rates as the UI uses them. Display only: never stored, never sent, never summed. */
export interface FxRates {
  /** Upper-case currency code the rates are quoted against. */
  base: string;
  /** Upper-case currency -> positive decimal string. Unusable rates are dropped, so "missing" means missing. */
  rates: Record<string, string>;
  /** Date the provider published the rates; `null` when the API did not say. Never replaced by today. */
  asOf: string | null;
  source: string | null;
}

const POSITIVE_DECIMAL = /^\d+(?:\.\d+)?$/;

function isUsableRate(rate: unknown): rate is string {
  return typeof rate === "string" && POSITIVE_DECIMAL.test(rate.trim()) && /[1-9]/.test(rate);
}

export function toFxRates(wire: ExchangeRatesResponse): FxRates {
  const rates: Record<string, string> = {};
  for (const [ccy, rate] of Object.entries(wire.rates ?? {})) {
    if (isUsableRate(rate)) rates[ccy.toUpperCase()] = rate.trim();
  }
  return { base: wire.base.toUpperCase(), rates, asOf: wire.asOf ?? null, source: wire.source ?? null };
}

/** The portal invoice's nullable `exchangeRates` block. */
export function portalRates(embedded: ExchangeRatesResponse | null | undefined): FxRates | null {
  return embedded ? toFxRates(embedded) : null;
}
