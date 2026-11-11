import axios from "axios";
import { responseToInvoice } from "@/lib/api/mappers/invoices";
import { portalRates, type FxRates } from "@/lib/api/mappers/exchange-rates";
import { responseToMilestone } from "@/lib/api/mappers/milestones";
import { apiDateToIso, asCurrency, FALLBACK_PROJECT_CURRENCY, statusFromApi } from "@/lib/api/mappers/projects";
import type { MilestoneResponse, PortalInvoiceResponse, PortalProjectResponse } from "@/lib/api/portal.types";
import { getApiErrorMessage } from "@/lib/services/api.service";
import type { Currency, InvoiceDetail, Milestone, ProjectStatus } from "@/lib/types";

export interface PortalInvoice {
  invoice: InvoiceDetail;
  rates: FxRates | null;
}

export function portalInvoiceToView(r: PortalInvoiceResponse): PortalInvoice {
  return { invoice: responseToInvoice(r), rates: portalRates(r.exchangeRates) };
}

export interface PortalProjectView {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  dueDate?: string;
  currency: Currency;
}

export function portalProjectToView(r: PortalProjectResponse): PortalProjectView {
  return {
    id: r.id,
    name: r.name,
    description: r.description || undefined,
    status: statusFromApi(r.status),
    dueDate: apiDateToIso(r.dueDate),
    currency: asCurrency(r.currency, FALLBACK_PROJECT_CURRENCY),
  };
}

/** The portal milestone carries no project currency, so amounts use the fallback only when present. */
export function portalMilestoneToView(r: MilestoneResponse, currency: Currency = FALLBACK_PROJECT_CURRENCY): Milestone {
  return responseToMilestone(r, currency);
}

export type PortalErrorKind = "expired" | "notfound" | "ratelimited" | "decision" | "offline" | "unknown";
export interface PortalError { kind: PortalErrorKind; message: string }

/** 401/403 = expired or invalid link, 404 = gone, 429 = rate limited, 400 = not decidable, no response = offline. */
export function classifyPortalError(err: unknown): PortalError {
  if (!axios.isAxiosError(err) || !err.response) {
    return axios.isAxiosError(err) ? { kind: "offline", message: "You’re offline." } : { kind: "unknown", message: getApiErrorMessage(err) };
  }
  const s = err.response.status;
  if (s === 401 || s === 403) return { kind: "expired", message: "This link has expired or isn’t valid." };
  if (s === 404) return { kind: "notfound", message: "We couldn’t find that." };
  if (s === 429) return { kind: "ratelimited", message: "Too many requests. Try again later." };
  if (s === 400) return { kind: "decision", message: getApiErrorMessage(err, "This can’t be changed right now.") };
  return { kind: "unknown", message: getApiErrorMessage(err) };
}
