import type { FxRates } from "./api/mappers/exchange-rates";
import { fractionDigits } from "./money";
import type { Currency } from "./types";

/**
 * Reference rates for ESTIMATES only. Paylancr never converts or moves money; the
 * actual rate is set by the client's bank or provider. Every converted figure in the
 * UI must carry ESTIMATE_LABEL and the reference date.
 */
export const FX_REF_DATE = "2026-10-03";

/** Units of currency per 1 USD. */
const PER_USD: Record<Currency, number> = {
  USD: 1,
  PKR: 278.6,
  EUR: 0.92,
  GBP: 0.78,
  AED: 3.6725,
};

export const ESTIMATE_LABEL = "≈ estimate";
export const FX_DISCLAIMER = "Reference rate only; the actual rate is set by your bank or provider.";
export const NO_PROCESSING = "Paylancr does not process payments. Pay the freelancer directly using the details below.";

export interface DisplayConversion {
  /** Minor units of the target currency. Display only: never add it to a total, store it or send it. */
  amount: number;
  /** Date the rates were published; `null` when unknown (never replaced by today). */
  asOf: string | null;
  source: string | null;
}

/** Only USD <-> PKR is ever shown as an estimate. */
export function counterpartOf(currency: Currency): Currency | undefined {
  return currency === "USD" ? "PKR" : currency === "PKR" ? "USD" : undefined;
}

const DECIMAL_RATE = /^(\d+)(?:\.(\d+))?$/;

/** "278.6" -> 2786 / 10; `null` when the rate is not a positive decimal. */
function parseRate(rate: string | undefined): { n: bigint; scale: bigint } | null {
  const m = rate === undefined ? null : DECIMAL_RATE.exec(rate.trim());
  if (!m) return null;
  const frac = m[2] ?? "";
  const n = BigInt(m[1] + frac);
  return n > BigInt(0) ? { n, scale: BigInt(10) ** BigInt(frac.length) } : null;
}

/** Units of `ccy` per 1 unit of the table's base (the base itself is exactly 1). */
function rateFor(ccy: Currency, rates: FxRates): { n: bigint; scale: bigint } | null {
  return ccy === rates.base ? { n: BigInt(1), scale: BigInt(1) } : parseRate(rates.rates[ccy]);
}

/**
 * Reference-rate estimate of `amountMinor` (minor units of `from`) in `to`, for display only.
 * Returns `null` (show nothing) for any pair other than USD <-> PKR, equal currencies, or when a needed rate is
 * missing or unusable: never guessed. BigInt arithmetic, rounded half away from zero; no float maths.
 */
export function convertForDisplay(amountMinor: number, from: Currency, to: Currency, rates: FxRates | null | undefined): DisplayConversion | null {
  if (!rates || from === to || counterpartOf(from) !== to || !Number.isSafeInteger(amountMinor)) return null;
  const rFrom = rateFor(from, rates);
  const rTo = rateFor(to, rates);
  if (!rFrom || !rTo) return null;
  const ten = BigInt(10);
  const num = BigInt(amountMinor) * ten ** BigInt(fractionDigits(to)) * rTo.n * rFrom.scale;
  const den = ten ** BigInt(fractionDigits(from)) * rTo.scale * rFrom.n;
  const neg = num < BigInt(0);
  const abs = neg ? -num : num;
  const q = (abs * BigInt(2) + den) / (den * BigInt(2));
  const out = Number(neg ? -q : q);
  return Number.isSafeInteger(out) ? { amount: out, asOf: rates.asOf, source: rates.source } : null;
}

/** Convert minor units from one currency to another at the reference rate. */
export function convertMinor(minor: number, from: Currency, to: Currency): number {
  if (from === to) return minor;
  return Math.round((minor / PER_USD[from]) * PER_USD[to]);
}
