"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { ExchangeRatesResponse } from "@/lib/api/exchange-rates.types";
import { type FxRates, portalRates, toFxRates } from "@/lib/api/mappers/exchange-rates";
import { exchangeRatesService } from "@/lib/services/exchange-rates.service";
import { useSession } from "@/lib/hooks/auth/use-auth";

export const exchangeRateKeys = { all: ["exchangeRates"] as const, latest: ["exchangeRates", "latest"] as const };

const SIX_HOURS = 6 * 60 * 60_000;

/** Reference rates for the signed-in app. Rates move daily, so they stay fresh for hours and never refetch on focus. */
export function useExchangeRates() {
  const { isAuthenticated } = useSession();
  return useQuery({
    queryKey: exchangeRateKeys.latest,
    queryFn: exchangeRatesService.get,
    enabled: isAuthenticated,
    staleTime: SIX_HOURS,
    gcTime: 24 * 60 * 60_000,
    refetchOnWindowFocus: false,
    select: toFxRates,
  });
}

/** Portal visitors have no account: rates come from the invoice response and the authenticated endpoint is never called. */
export function usePortalExchangeRates(embedded: ExchangeRatesResponse | null | undefined): FxRates | null {
  return useMemo(() => portalRates(embedded), [embedded]);
}
