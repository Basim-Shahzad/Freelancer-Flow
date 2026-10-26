import { toDecimal, toMinor } from "@/lib/api/money";
import type {
  TimeEntryBulkSet, TimeEntryCreate, TimeEntryResponse, TimeEntryStart, TimeEntrySyncItem, TimeEntryUpdate,
} from "@/lib/api/time-entries.types";
import { isoDate, localHHMM } from "@/lib/dates";
import type { Currency, TimeEntry } from "@/lib/types";

/** The currency of a project's rates, or undefined when unknown (the rate is then left out). */
export type CurrencyOf = (projectId: string) => Currency | undefined;

/** An API entry as the screens use it: local day, local `HH:MM` and whole minutes derived from the UTC timestamps. */
export function responseToTimeEntry(r: TimeEntryResponse, currencyOf?: CurrencyOf): TimeEntry {
  const start = new Date(r.startTime);
  const currency = currencyOf?.(r.projectId);
  return {
    id: r.id,
    projectId: r.projectId,
    milestoneId: r.milestoneId ?? undefined,
    description: r.description,
    date: isoDate(start),
    startTime: localHHMM(start),
    startAt: r.startTime,
    endAt: r.endTime ?? undefined,
    minutes: r.isRunning ? 0 : r.durationMinutes,
    billable: r.isBillable,
    isInvoiced: r.isInvoiced,
    hourlyRate: r.hourlyRate !== null && currency ? toMinor(r.hourlyRate, currency) : undefined,
    updatedAt: r.updatedAt,
  };
}

/** Local `YYYY-MM-DD` + `HH:MM` -> a UTC ISO timestamp. */
export function localToUtc(date: string, hhmm: string): string {
  return new Date(`${date}T${hhmm}:00`).toISOString();
}

/** UTC ISO `minutes` after `startIso`. */
export const addMinutesIso = (startIso: string, minutes: number): string => new Date(new Date(startIso).getTime() + minutes * 60_000).toISOString();

/** The fields the add / edit form holds. */
export interface TimeEntryInput {
  description: string;
  projectId: string;
  /** "" = none. */
  milestoneId: string;
  date: string;
  startTime: string;
  minutes: number;
  billable: boolean;
}

export function entryToInput(e: TimeEntry): TimeEntryInput {
  return {
    description: e.description, projectId: e.projectId ?? "", milestoneId: e.milestoneId ?? "", date: e.date,
    startTime: e.startTime ?? "09:00", minutes: e.minutes, billable: e.billable,
  };
}

/** `rate` is only sent when it is set explicitly; otherwise the server snapshots the project's rate. */
const rateField = (rate: number | undefined, currency: Currency | undefined) =>
  rate !== undefined && currency ? { hourlyRate: toDecimal(rate, currency) } : {};

export function inputToCreate(i: TimeEntryInput): TimeEntryCreate {
  const startTime = localToUtc(i.date, i.startTime);
  return {
    description: i.description.trim(), projectId: i.projectId, milestoneId: i.milestoneId || null, isBillable: i.billable,
    startTime, endTime: addMinutesIso(startTime, i.minutes),
  };
}

/** PATCH body for an edit: the project cannot change here (use bulk edit); a cleared milestone is sent as null. */
export function inputToUpdate(i: TimeEntryInput): TimeEntryUpdate {
  const startTime = localToUtc(i.date, i.startTime);
  return {
    description: i.description.trim(), isBillable: i.billable, milestoneId: i.milestoneId || null,
    startTime, endTime: addMinutesIso(startTime, i.minutes),
  };
}

export interface StartInput {
  description: string;
  projectId: string;
  milestoneId?: string;
  billable?: boolean;
  /** UTC ISO; omitted = now on the server. */
  startAt?: string;
  rate?: number;
  currency?: Currency;
}

export function inputToStart(i: StartInput): TimeEntryStart {
  return {
    description: i.description.trim(), projectId: i.projectId, milestoneId: i.milestoneId || null, isBillable: i.billable ?? true,
    ...(i.startAt ? { startTime: i.startAt } : {}), ...rateField(i.rate, i.currency),
  };
}

/** What a bulk edit may change. Only the keys present are sent; `milestoneId: null` clears it. */
export interface BulkChange {
  projectId?: string;
  milestoneId?: string | null;
  billable?: boolean;
  description?: string;
}

export function bulkToWire(c: BulkChange): TimeEntryBulkSet {
  const out: TimeEntryBulkSet = {};
  if (c.projectId !== undefined) out.projectId = c.projectId;
  if (c.milestoneId !== undefined) out.milestoneId = c.milestoneId;
  if (c.billable !== undefined) out.isBillable = c.billable;
  if (c.description !== undefined) out.description = c.description.trim();
  return out;
}

/** An outbox entry as the sync endpoint wants it. */
export function toSyncItem(e: {
  id: string; projectId: string; milestoneId?: string; description: string; startAt: string; endAt?: string | null;
  billable: boolean; seenUpdatedAt?: string; deleted?: boolean;
}): TimeEntrySyncItem {
  return {
    id: e.id, projectId: e.projectId, milestoneId: e.milestoneId ?? null, description: e.description, startTime: e.startAt,
    endTime: e.endAt ?? null, isBillable: e.billable, updatedAt: e.seenUpdatedAt ?? null, deleted: e.deleted ?? false,
  };
}
