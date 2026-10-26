import type { ExchangeRatesResponse } from "@/lib/api/exchange-rates.types";
import { api } from "./api.service";

export const exchangeRatesService = {
  get: () => api.get<ExchangeRatesResponse>("/reference/exchange-rates").then((r) => r.data),
};
