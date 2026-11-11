/** Wire types for `/portal/*` (token-based, no account). Reuses the invoice and milestone shapes. */
import type { ExchangeRatesResponse } from "@/lib/api/exchange-rates.types";
import type { InvoiceResponse } from "@/lib/api/invoices.types";
import type { ApiProjectStatus } from "@/lib/api/projects.types";

export type { MilestoneResponse } from "@/lib/api/projects.types";

/** What a client may see of a project (no milestones, invoices or owner info). */
export interface PortalProjectResponse {
  id: string;
  name: string;
  description: string | null;
  status: ApiProjectStatus;
  dueDate: string | null;
  currency: string | null;
}

/** An invoice response plus the reference rates embedded for the visitor (no authenticated call). */
export interface PortalInvoiceResponse extends InvoiceResponse {
  exchangeRates: ExchangeRatesResponse | null;
}

export interface MilestoneDecision {
  comment?: string | null;
}

export interface PortalConvertRequest {
  password: string;
}
