import { startOfWeek } from "date-fns";
import { isoDate, parse } from "@/lib/dates";
import type { TimeEntry } from "@/lib/types";

/** Pure logic for the Time screen (grouping, filtering, totals). */

export type BillFilter = "all" | "billable" | "non-billable";
export type InvoicedFilter = "all" | "uninvoiced" | "invoiced";
export const ALL_PROJECTS = "all";

export interface TimeFilters {
  /** "all" or a project id. */
  project: string;
  billable: BillFilter;
  invoiced: InvoicedFilter;
}

export const DEFAULT_FILTERS: TimeFilters = { project: ALL_PROJECTS, billable: "all", invoiced: "all" };

export function matchesFilters(e: { projectId?: string; billable: boolean; invoiced: boolean }, f: TimeFilters): boolean {
  if (f.project !== ALL_PROJECTS && e.projectId !== f.project) return false;
  if (f.billable === "billable" && !e.billable) return false;
  if (f.billable === "non-billable" && e.billable) return false;
  if (f.invoiced === "invoiced" && !e.invoiced) return false;
  if (f.invoiced === "uninvoiced" && e.invoiced) return false;
  return true;
}

export const filterEntries = (list: TimeEntry[], f: TimeFilters): TimeEntry[] =>
  list.filter((t) => matchesFilters({ projectId: t.projectId, billable: t.billable, invoiced: t.isInvoiced }, f));

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

