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
export const FX_DISCLAIMER = "Reference rate only; the actual rate is set by your bank or provider";
export const NO_PROCESSING = "Paylancr does not process payments. Pay the freelancer directly using the details below.";

/** Convert minor units from one currency to another at the reference rate. */
export function convertMinor(minor: number, from: Currency, to: Currency): number {
  if (from === to) return minor;
  return Math.round((minor / PER_USD[from]) * PER_USD[to]);
}
