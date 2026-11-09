import type { ActivityParams } from "@/lib/services/activity.service";
import { addDays } from "@/lib/dates";

export type ActivitySegment = "all" | "invoice" | "project" | "client" | "time_entry";
export type ActivityRange = "7" | "30" | "all";
export interface ActivityFilter { segment: ActivitySegment; range: ActivityRange }

export const DEFAULT_FILTER: ActivityFilter = { segment: "all", range: "30" };

export const SEGMENTS: { value: ActivitySegment; label: string }[] = [
  { value: "all", label: "All" },
  { value: "invoice", label: "Invoices" },
  { value: "project", label: "Projects" },
  { value: "client", label: "Clients" },
  { value: "time_entry", label: "Time" },
];

export const isFiltered = (f: ActivityFilter) => f.segment !== "all" || f.range !== DEFAULT_FILTER.range;

/** UI filter → query params. "7" = today and the six days before, from the start of that local day. */
export function toActivityParams(f: ActivityFilter, now: Date = new Date()): ActivityParams {
  const params: ActivityParams = {};
  if (f.segment !== "all") params.entity_type = f.segment;
  if (f.range !== "all") {
    const start = addDays(now, -(Number(f.range) - 1));
    start.setHours(0, 0, 0, 0);
    params.from = start.toISOString();
  }
  return params;
}

const ENTITY_LABEL: Record<string, string> = { invoice: "Invoice", project: "Project", client: "Client", time_entry: "Time entry", milestone: "Milestone", payment: "Payment", payment_method: "Payment method", change_request: "Change request", user: "Account" };

const titleCase = (s: string) => { const t = s.replace(/[_-]+/g, " ").trim(); return t.charAt(0).toUpperCase() + t.slice(1); };

export const entityLabel = (entityType: string) => ENTITY_LABEL[entityType] ?? titleCase(entityType);
export const actionLabel = (action: string) => titleCase(action);

const ENTITY_HREF: Record<string, string> = { invoice: "/invoices", project: "/projects", client: "/clients" };

/** Deep link to the screen for the entity an event happened to. */
export function activityHref(entityType: string, entityId: string): string {
  const base = ENTITY_HREF[entityType];
  return base ? `${base}/${entityId}` : entityType === "time_entry" ? "/time" : "/settings/activity";
}

const REDACTED = "[redacted]";
const isPair = (v: unknown): v is { old: unknown; new: unknown } => typeof v === "object" && v !== null && "old" in v && "new" in v;
const show = (v: unknown): string => (v === null || v === undefined || v === "" ? "empty" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** The redacted diff as lines. Secret fields only say that they changed; their values are never printed. */
export function describeChanges(changes: Record<string, unknown> | null | undefined): string[] {
  if (!changes) return [];
  return Object.entries(changes).map(([field, v]) => {
    const name = titleCase(field);
    if (isPair(v)) {
      if (v.old === REDACTED || v.new === REDACTED) return `${name} changed`;
      return `${name}: ${show(v.old)} → ${show(v.new)}`;
    }
    if (v === REDACTED) return `${name} changed`;
    return `${name} changed`;
  });
}

