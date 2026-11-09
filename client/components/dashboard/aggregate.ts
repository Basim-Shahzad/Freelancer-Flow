import type { ByCurrency } from "@/lib/api/mappers/dashboard";
import { CURRENCIES, type Currency } from "@/lib/types";

export type { ByCurrency };

/** Non-zero entries in a stable currency order. */
export function currencyEntries(by: ByCurrency): [Currency, number][] {
  return CURRENCIES.filter((c) => (by[c] ?? 0) !== 0).map((c) => [c, by[c] ?? 0]);
}

/** Where to show an ≈ estimate for a currency: the opposite of the business default. */
export function estimateTarget(currency: Currency, base: Currency): Currency {
  if (currency !== base) return base;
  return base === "PKR" ? "USD" : "PKR";
}
