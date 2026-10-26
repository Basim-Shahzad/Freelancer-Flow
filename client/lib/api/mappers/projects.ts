import { toDecimal, toMinor } from "@/lib/api/money";
import type {
  ApiBillingType, ApiProjectStatus, ApiRetainerInterval, ProjectCreate, ProjectResponse, ProjectUpdate,
  RetainerPeriodResponse,
} from "@/lib/api/projects.types";
import {
  CURRENCIES, type BillingType, type Currency, type Project, type ProjectStatus, type RetainerInterval, type RetainerPeriod,
} from "@/lib/types";

const asCurrency = (c: string | null | undefined, fallback: Currency): Currency => CURRENCIES.find((x) => x === c) ?? fallback;

/** `2026-11-01T00:00:00Z` -> `2026-11-01`. */
export const apiDateToIso = (d: string | null | undefined): string | undefined => (d ? d.slice(0, 10) : undefined);

/** `2026-11-01` -> a UTC-midnight timestamp, which `apiDateToIso` maps straight back. */
export const isoToApiDateTime = (d: string): string => `${d}T00:00:00Z`;

export const billingTypeFromApi = (t: ApiBillingType): BillingType => t.toLowerCase() as BillingType;
export const billingTypeToApi = (t: BillingType): ApiBillingType => t.toUpperCase() as ApiBillingType;
export const statusFromApi = (s: ApiProjectStatus): ProjectStatus => s.toLowerCase() as ProjectStatus;
export const statusToApi = (s: ProjectStatus): ApiProjectStatus => s.toUpperCase() as ApiProjectStatus;

function intervalFromApi(i: ApiRetainerInterval | null): RetainerInterval | undefined {
  return i === "MONTHLY" ? "monthly" : i === "QUARTERLY" ? "quarterly" : undefined;
}
const intervalToApi = (i: RetainerInterval): ApiRetainerInterval => (i === "monthly" ? "MONTHLY" : "QUARTERLY");

/** Used when the API leaves `currency` null (it normally defaults to the client's, then the profile's). */
export const FALLBACK_PROJECT_CURRENCY: Currency = "USD";

export function responseToProject(r: ProjectResponse, fallbackCurrency: Currency = FALLBACK_PROJECT_CURRENCY): Project {
  const currency = asCurrency(r.currency, fallbackCurrency);
  const money = (v: string | null) => (v === null ? undefined : toMinor(v, currency));
  return {
    id: r.id,
    clientId: r.client.id,
    client: { id: r.client.id, name: r.client.name },
    name: r.name,
    description: r.description ?? "",
    billingType: billingTypeFromApi(r.billingType),
    currency,
    status: statusFromApi(r.status),
    budget: money(r.budget),
    hourlyRate: money(r.hourlyRate),
    retainerAmount: money(r.retainerAmount),
    retainerInterval: intervalFromApi(r.retainerInterval),
    retainerStartDate: apiDateToIso(r.retainerStartDate),
    retainerEndDate: apiDateToIso(r.retainerEndDate),
    dueDate: apiDateToIso(r.dueDate),
    milestonesEnabled: r.milestonesEnabled || r.billingType === "MILESTONE",
    totalTimeSpentMinutes: r.totalTimeSpentMinutes,
    progressPercent: r.progressPercent,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** The editable fields, as the form holds them. Money is in minor units. */
export interface ProjectInput {
  name: string;
  clientId: string;
  description: string;
  billingType: BillingType;
  currency: Currency;
  status: ProjectStatus;
  /** FIXED only. */
  budget?: number;
  /** HOURLY only. */
  hourlyRate?: number;
  /** RETAINER only. */
  retainerAmount?: number;
  retainerInterval?: RetainerInterval;
  retainerStartDate?: string;
  retainerEndDate?: string;
  dueDate?: string;
  milestonesEnabled: boolean;
}

export function projectToInput(p: Project): ProjectInput {
  return {
    name: p.name, clientId: p.clientId, description: p.description, billingType: p.billingType, currency: p.currency, status: p.status,
    budget: p.budget, hourlyRate: p.hourlyRate, retainerAmount: p.retainerAmount, retainerInterval: p.retainerInterval,
    retainerStartDate: p.retainerStartDate, retainerEndDate: p.retainerEndDate, dueDate: p.dueDate, milestonesEnabled: p.milestonesEnabled,
  };
}

/** Only the fields that apply to the billing type are sent, so switching type clears the old type's fields. */
function toWire(p: ProjectInput): Required<Omit<ProjectCreate, "type">> {
  const money = (minor: number | undefined) => (minor === undefined ? null : toDecimal(minor, p.currency));
  const fixed = p.billingType === "fixed";
  const retainer = p.billingType === "retainer";
  const description = p.description.trim();
  return {
    name: p.name.trim(),
    clientId: p.clientId,
    description: description === "" ? null : description,
    status: statusToApi(p.status),
    billingType: billingTypeToApi(p.billingType),
    currency: p.currency,
    budget: fixed ? money(p.budget) : null,
    hourlyRate: p.billingType === "hourly" ? money(p.hourlyRate) : null,
    retainerAmount: retainer ? money(p.retainerAmount) : null,
    retainerInterval: retainer && p.retainerInterval ? intervalToApi(p.retainerInterval) : null,
    retainerStartDate: retainer && p.retainerStartDate ? p.retainerStartDate : null,
    retainerEndDate: retainer && p.retainerEndDate ? p.retainerEndDate : null,
    dueDate: p.dueDate ? isoToApiDateTime(p.dueDate) : null,
    // The server forces this on for MILESTONE projects; send it that way so the form and server agree.
    milestonesEnabled: p.billingType === "milestone" ? true : p.milestonesEnabled,
  };
}

export function projectToCreate(p: ProjectInput): ProjectCreate {
  return toWire(p);
}

/** PATCH body with only the fields that differ from `previous` (a cleared field is sent as null). */
export function projectToUpdate(next: ProjectInput, previous: ProjectInput): ProjectUpdate {
  const full = toWire(next);
  const before = toWire(previous);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(full) as (keyof typeof full)[]) {
    if (full[key] !== before[key]) out[key] = full[key];
  }
  return out as ProjectUpdate;
}

export function responseToPeriod(r: RetainerPeriodResponse, amount: number): RetainerPeriod {
  return { id: r.periodStart, label: r.label, start: r.periodStart, end: r.periodEnd, amount, invoiceId: r.invoiceId ?? undefined };
}
