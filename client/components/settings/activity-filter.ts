import { differenceInCalendarDays } from "date-fns";
import type { ActivityEntry, ActivityType } from "@/lib/types";

export type ActivitySegment = "all" | "invoice" | "payment" | "project" | "settings";
export type ActivityRange = "7" | "30" | "all";

export const SEGMENTS: { value: ActivitySegment; label: string }[] = [
  { value: "all", label: "All" },
  { value: "invoice", label: "Invoices" },
  { value: "payment", label: "Payments" },
  { value: "project", label: "Projects" },
  { value: "settings", label: "Settings" },
];

export const TYPE_LABEL: Record<ActivityType, string> = {
  invoice: "Invoice", payment: "Payment", project: "Project", client: "Client", time: "Time", settings: "Settings",
};

export interface ActivityFilter { segment: ActivitySegment; range: ActivityRange; query: string }

export const DEFAULT_FILTER: ActivityFilter = { segment: "all", range: "30", query: "" };

/**
 * Newest first. "All" includes every type (also client and time); a segment shows only its own type.
 * Range counts calendar days including today ("7" = today and the six days before).
 */
export function filterActivity(entries: ActivityEntry[], f: ActivityFilter, now: Date = new Date()): ActivityEntry[] {
  const q = f.query.trim().toLowerCase();
  const days = f.range === "all" ? Infinity : Number(f.range);
  return entries
    .filter((e) => {
      if (f.segment !== "all" && e.type !== f.segment) return false;
      if (days !== Infinity && differenceInCalendarDays(now, new Date(e.at)) >= days) return false;
      if (q && !`${e.action} ${e.record} ${e.detail} ${TYPE_LABEL[e.type]}`.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export const isFiltered = (f: ActivityFilter) => f.segment !== "all" || f.query.trim() !== "" || f.range !== DEFAULT_FILTER.range;
