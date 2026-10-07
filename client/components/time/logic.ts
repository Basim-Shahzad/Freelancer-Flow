import { startOfWeek } from "date-fns";
import { daysBetween, isoDate, parse } from "@/lib/dates";
import type { TimeEntry } from "@/lib/types";

/** Pure logic for the Time screen (grouping, filtering, totals, conflict derivation). */

export type BillFilter = "all" | "billable" | "non-billable";
export type InvoicedFilter = "all" | "uninvoiced" | "invoiced";
export const ALL_PROJECTS = "all";
export const NO_PROJECT = "none";

export interface TimeFilters {
  /** "all", "none" (internal) or a project id. */
  project: string;
  billable: BillFilter;
  invoiced: InvoicedFilter;
}

export const DEFAULT_FILTERS: TimeFilters = { project: ALL_PROJECTS, billable: "all", invoiced: "all" };

export function matchesFilters(e: { projectId?: string; billable: boolean; invoiced: boolean }, f: TimeFilters): boolean {
  if (f.project === NO_PROJECT ? e.projectId !== undefined : f.project !== ALL_PROJECTS && e.projectId !== f.project) return false;
  if (f.billable === "billable" && !e.billable) return false;
  if (f.billable === "non-billable" && e.billable) return false;
  if (f.invoiced === "invoiced" && !e.invoiced) return false;
  if (f.invoiced === "uninvoiced" && e.invoiced) return false;
  return true;
}

export const filterEntries = (list: TimeEntry[], f: TimeFilters): TimeEntry[] =>
  list.filter((t) => matchesFilters({ projectId: t.projectId, billable: t.billable, invoiced: Boolean(t.invoiceId) }, f));

export interface DayGroup {
  date: string;
  entries: TimeEntry[];
  /** Minutes of the running timer counted on this day (0 when none). */
  runningMinutes: number;
  /** Day total including the running timer. */
  minutes: number;
}

/** Group entries by day, newest day first. A running timer adds a group for its day if needed. */
export function groupByDay(entries: TimeEntry[], running?: { date: string; minutes: number }): DayGroup[] {
  const map = new Map<string, DayGroup>();
  const ensure = (date: string): DayGroup => {
    const g = map.get(date) ?? { date, entries: [], runningMinutes: 0, minutes: 0 };
    map.set(date, g);
    return g;
  };
  for (const e of entries) {
    const g = ensure(e.date);
    g.entries.push(e);
    g.minutes += e.minutes;
  }
  if (running) {
    const g = ensure(running.date);
    g.runningMinutes = running.minutes;
    g.minutes += running.minutes;
  }
  const groups = [...map.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  for (const g of groups) g.entries.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  return groups;
}

/** Minutes logged since Monday of the week containing `today` (running timer included). */
export function weekTotalMinutes(entries: TimeEntry[], today: string, runningMinutes = 0): number {
  const start = isoDate(startOfWeek(parse(today), { weekStartsOn: 1 }));
  return entries.filter((e) => e.date >= start && e.date <= today).reduce((s, e) => s + e.minutes, runningMinutes);
}

/* ------------------------------------------------------------------ conflicts */

const DAY_MS = 86_400_000;

/**
 * DEMO conflict rule (there is no backend to compare against).
 * An entry is "conflicted" when it is unsynced AND either
 *  - it has been stuck unsynced for more than one day (`updatedAt` older than 24 h), or
 *  - it was edited at least a day after its work date (a back-dated offline edit),
 * i.e. cases where another device could plausibly have changed the same entry.
 * Invoiced entries are locked and can never conflict.
 */
export function isConflicted(t: TimeEntry, now: number = Date.now()): boolean {
  if (!t.unsynced || t.invoiceId) return false;
  const edited = new Date(t.updatedAt).getTime();
  if (Number.isNaN(edited)) return false;
  if (now - edited > DAY_MS) return true;
  return daysBetween(isoDate(new Date(edited)), t.date) >= 1;
}

export interface ServerVersion { description: string; minutes: number; billable: boolean; updatedAt: string }
export interface TimeConflict { entry: TimeEntry; server: ServerVersion }

/** DEMO "server copy": same entry with a duration that differs by 30 minutes, edited 14 h later. */
export function serverVersionOf(t: TimeEntry): ServerVersion {
  return {
    description: t.description,
    minutes: t.minutes > 30 ? t.minutes - 30 : t.minutes + 30,
    billable: t.billable,
    updatedAt: new Date(new Date(t.updatedAt).getTime() + 14 * 3_600_000).toISOString(),
  };
}

export function deriveConflicts(entries: TimeEntry[], now: number = Date.now()): TimeConflict[] {
  return entries.filter((t) => isConflicted(t, now)).map((entry) => ({ entry, server: serverVersionOf(entry) }));
}
