import type { FxRates } from "@/lib/api/mappers/exchange-rates";

/**
 * Illustration only: the marketing pages have no session, so their sample invoice uses this fixed table. The date
 * is real and shown next to the figure, so it is never presented as a live rate.
 */
export const SPECIMEN_RATES: FxRates = {
  base: "USD",
  rates: { PKR: "278.6" },
  asOf: "2026-10-03",
  source: "sample rate",
};
