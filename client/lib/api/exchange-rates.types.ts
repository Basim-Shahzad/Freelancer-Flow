/** `GET /reference/exchange-rates`, and the same block embedded as `exchangeRates` on the portal invoice. */
export interface ExchangeRatesResponse {
  /** Currency the rates are quoted against (1 unit of `base` = `rates[CCY]` units of CCY). */
  base: string;
  /** Decimal strings, e.g. `{ PKR: "278.6000" }`. */
  rates: Record<string, string>;
  asOf: string | null;
  source: string | null;
}
