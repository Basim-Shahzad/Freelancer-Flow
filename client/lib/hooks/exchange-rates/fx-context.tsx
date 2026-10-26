"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { FxRates } from "@/lib/api/mappers/exchange-rates";
import { useExchangeRates } from "./use-exchange-rates";

const FxRatesContext = createContext<FxRates | null>(null);

/** Reference rates for `<Money estimateIn>`; `null` (no provider, or rates not loaded) means no estimate is shown. */
export function useFxRates(): FxRates | null {
  return useContext(FxRatesContext);
}

/** Supplies rates from props: the portal (rates embedded in the invoice) and marketing specimens. Never calls the API. */
export function FxRatesProvider({ rates, children }: { rates: FxRates | null; children: ReactNode }) {
  return <FxRatesContext.Provider value={rates}>{children}</FxRatesContext.Provider>;
}

/** The signed-in app: rates from `GET /reference/exchange-rates`. A loading or failed query simply means no estimate. */
export function AuthedFxRatesProvider({ children }: { children: ReactNode }) {
  const { data } = useExchangeRates();
  return <FxRatesProvider rates={data ?? null}>{children}</FxRatesProvider>;
}
