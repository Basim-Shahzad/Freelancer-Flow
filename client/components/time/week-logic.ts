import { startOfWeek } from "date-fns";
import { addDays, isoDate, parse } from "@/lib/dates";
import { deriveStatus } from "@/lib/invoice";
import type { Currency, Invoice, Project, TimeEntry } from "@/lib/types";

/** Pure logic for the week view: bucketing, block geometry, billing-state classification, heatmap. */

export const WEEK_STARTS_ON = 1 as const; // Monday, same as weekTotalMinutes in ./logic
export const DAY_MINUTES = 1440;
export const DEFAULT_RANGE = { start: 8, end: 20 } as const;
/** Entries without a startTime (older data) are stacked from here. */
export const STACK_START_MIN = 9 * 60;
export const STACK_GAP_MIN = 15;
export const MIN_BLOCK_MIN = 20;

/* ------------------------------------------------------------------ weeks */

export const weekStartOf = (date: string): string => isoDate(startOfWeek(parse(date), { weekStartsOn: WEEK_STARTS_ON }));
export const shiftWeek = (start: string, n: number): string => isoDate(addDays(parse(start), n * 7));
export const weekDays = (start: string): string[] => Array.from({ length: 7 }, (_, i) => isoDate(addDays(parse(start), i)));
/** Index 0 = Monday … 6 = Sunday. */
export const dayIndex = (date: string): number => (parse(date).getDay() + 6) % 7;
export const isWeekend = (date: string): boolean => dayIndex(date) >= 5;

/** Entries bucketed by ISO date, restricted to the 7 days of the week. Missing days map to []. */
export function bucketWeek<T extends { date: string }>(entries: T[], start: string): Map<string, T[]> {
  const days = weekDays(start);
  const map = new Map<string, T[]>(days.map((d) => [d, []]));
  for (const e of entries) map.get(e.date)?.push(e);
  return map;
}

/** Last `n` week starts ending with the week of `currentStart` (oldest first). */
export const heatWeeks = (currentStart: string, n = 12): string[] => Array.from({ length: n }, (_, i) => shiftWeek(currentStart, i - (n - 1)));

/* ------------------------------------------------------------------ billing state */

export type BillState = "paid" | "invoiced" | "unbilled" | "fee" | "nonbill" | "live";

export const STATE_LABEL: Record<BillState, string> = {
  paid: "paid",
  invoiced: "invoiced",
  unbilled: "not billed",
  fee: "in the fee",
  nonbill: "non-billable",
  live: "running",
};

/**
 * How far the money has got for one entry.
 * - internal / non-billable time → "nonbill"
 * - fixed, milestone and retainer projects are already priced → "fee"
 * - hourly: on a paid invoice → "paid", on any other live invoice → "invoiced", else "unbilled".
 *   A void invoice releases its hours, so they count as unbilled again.
 */
export function classifyEntry(
  e: Pick<TimeEntry, "billable" | "projectId" | "invoiceId">,
  project: Pick<Project, "billingType"> | undefined,
  invoice: Invoice | undefined,
  today?: string,
): BillState {
  if (!e.billable || !e.projectId || !project) return "nonbill";
  if (project.billingType !== "hourly") return "fee";
  if (!e.invoiceId) return "unbilled";
  if (!invoice) return "invoiced";
  const status = deriveStatus(invoice, today);
  if (status === "paid") return "paid";
  if (status === "void") return "unbilled";
  return "invoiced";
}

/** Money for `minutes` at an hourly rate (minor units, rounded). */
export const amountFor = (minutes: number, hourlyRate: number | undefined): number => Math.round((minutes * (hourlyRate ?? 0)) / 60);

export type MoneyByCurrency = Partial<Record<Currency, number>>;
export const addMoney = (m: MoneyByCurrency, cur: Currency, amount: number): void => { m[cur] = (m[cur] ?? 0) + amount; };
/** Entries of [currency, amount] in a stable order, zeros removed. Never sums across currencies. */
export const moneyList = (m: MoneyByCurrency): [Currency, number][] =>
  (Object.entries(m) as [Currency, number][]).filter(([, v]) => v > 0).sort(([a], [b]) => (a < b ? -1 : 1));

export interface ClassifiedEntry { entry: TimeEntry; state: BillState; project?: Project }

export function classifyAll(entries: TimeEntry[], projects: Project[], invoices: Invoice[], today?: string): ClassifiedEntry[] {
  const pById = new Map(projects.map((p) => [p.id, p]));
  const iById = new Map(invoices.map((i) => [i.id, i]));
  return entries.map((entry) => {
    const project = entry.projectId ? pById.get(entry.projectId) : undefined;
    return { entry, project, state: classifyEntry(entry, project, entry.invoiceId ? iById.get(entry.invoiceId) : undefined, today) };
  });
}

/* ------------------------------------------------------------------ block geometry */

export interface RawBlock {
  id: string;
  minutes: number;
  /** Fixed start (minutes from midnight). Omitted → stacked after the previous block. */
  startMin?: number;
  order?: string;
}

export interface Block { id: string; startMin: number; endMin: number; lane: number; lanes: number }

/**
 * Lay one day out. Blocks with a fixed start (entry startTime, the running timer) keep it; blocks without one
 * (legacy entries) are stacked from 09:00 (oldest edit first, 15 min apart).
 * Overlaps are put side by side in lanes.
 */
export function layoutDay(raw: RawBlock[]): Block[] {
  const stacked = raw.filter((r) => r.startMin === undefined).sort((a, b) => ((a.order ?? "") < (b.order ?? "") ? -1 : (a.order ?? "") > (b.order ?? "") ? 1 : a.id < b.id ? -1 : 1));
  const placed: { id: string; startMin: number; endMin: number }[] = [];
  let cursor = STACK_START_MIN;
  for (const r of stacked) {
    const startMin = Math.min(cursor, DAY_MINUTES - 1);
    const endMin = Math.min(startMin + Math.max(r.minutes, 1), DAY_MINUTES);
    placed.push({ id: r.id, startMin, endMin });
    cursor = endMin + STACK_GAP_MIN;
  }
  for (const r of raw) {
    if (r.startMin === undefined) continue;
    const startMin = Math.max(0, Math.min(r.startMin, DAY_MINUTES - 1));
    placed.push({ id: r.id, startMin, endMin: Math.min(startMin + Math.max(r.minutes, 1), DAY_MINUTES) });
  }
  placed.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  // greedy lanes inside each cluster of mutually overlapping blocks
  const out: Block[] = [];
  let cluster: { id: string; startMin: number; endMin: number; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const c of cluster) out.push({ ...c, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };
  for (const p of placed) {
    if (p.startMin >= clusterEnd) { flush(); clusterEnd = -1; }
    let lane = laneEnds.findIndex((end) => end <= p.startMin);
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(p.endMin); } else laneEnds[lane] = p.endMin;
    cluster.push({ ...p, lane });
    clusterEnd = Math.max(clusterEnd, p.endMin);
  }
  flush();
  return out;
}

export interface HourRange { start: number; end: number }

/** Hour axis: 08:00–20:00 by default, widened (whole hours, within the day) to hold every block. */
export function hourRange(blocks: { startMin: number; endMin: number }[]): HourRange {
  let start: number = DEFAULT_RANGE.start;
  let end: number = DEFAULT_RANGE.end;
  for (const b of blocks) {
    start = Math.min(start, Math.floor(b.startMin / 60));
    end = Math.max(end, Math.ceil(b.endMin / 60));
  }
  return { start: Math.max(0, start), end: Math.min(24, end) };
}

/** Top / height in percent of the axis, clamped to it; tiny blocks get a minimum height. */
export function blockGeometry(b: { startMin: number; endMin: number }, range: HourRange): { top: number; height: number } {
  const span = (range.end - range.start) * 60;
  const from = Math.max(b.startMin, range.start * 60);
  const to = Math.min(Math.max(b.endMin, b.startMin + MIN_BLOCK_MIN), range.end * 60);
  const top = ((from - range.start * 60) / span) * 100;
  return { top, height: Math.max(((to - from) / span) * 100, (MIN_BLOCK_MIN / span) * 100) };
}

/** Tick hours for the gutter (every 2 h from the first even hour). */
export function axisTicks(range: HourRange, step = 2): number[] {
  const ticks: number[] = [];
  for (let h = range.start; h <= range.end; h += step) ticks.push(h);
  return ticks;
}

export const nowPercent = (nowMin: number, range: HourRange): number | null => {
  const span = (range.end - range.start) * 60;
  const p = ((nowMin - range.start * 60) / span) * 100;
  return p < 0 || p > 100 ? null : p;
};

export const hhmm = (min: number): string => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(Math.round(min) % 60).padStart(2, "0")}`;

/* ------------------------------------------------------------------ heatmap */

/** 0 = nothing, 1 < 3 h, 2 < 6 h, 3 < 9 h, 4 = 9 h+. */
export function heatLevel(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0;
  const h = minutes / 60;
  return h < 3 ? 1 : h < 6 ? 2 : h < 9 ? 3 : 4;
}

/** Percent of the primary token mixed into the surface, per level. */
export const HEAT_MIX: Record<0 | 1 | 2 | 3 | 4, number> = { 0: 0, 1: 22, 2: 45, 3: 70, 4: 100 };
export const heatBackground = (minutes: number): string => `color-mix(in srgb, var(--primary) ${HEAT_MIX[heatLevel(minutes)]}%, var(--background))`;

/** Minutes per ISO date. */
export function minutesByDate(entries: { date: string; minutes: number }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) m.set(e.date, (m.get(e.date) ?? 0) + e.minutes);
  return m;
}

/* ------------------------------------------------------------------ summaries */

export interface WeekSummary {
  /** Billable minutes (running included). */
  billable: number;
  fee: number;
  hourly: number;
  unbilled: number;
  /** Value of unbilled hourly minutes per currency. */
  unbilledMoney: MoneyByCurrency;
}

export function summarizeWeek(items: ClassifiedEntry[], runningMinutes = 0): WeekSummary {
  const s: WeekSummary = { billable: runningMinutes, fee: 0, hourly: runningMinutes, unbilled: 0, unbilledMoney: {} };
  for (const { entry, state, project } of items) {
    if (state === "nonbill") continue;
    s.billable += entry.minutes;
    if (state === "fee") s.fee += entry.minutes;
    else s.hourly += entry.minutes;
    if (state === "unbilled" && project) {
      s.unbilled += entry.minutes;
      addMoney(s.unbilledMoney, project.currency, amountFor(entry.minutes, project.hourlyRate));
    }
  }
  return s;
}

export interface UnbilledProject { projectId: string; name: string; currency: Currency; minutes: number; amount: number }

/** Unbilled hourly work across all time, biggest (most hours) first. */
export function unbilledByProject(items: ClassifiedEntry[]): UnbilledProject[] {
  const map = new Map<string, UnbilledProject>();
  for (const { entry, state, project } of items) {
    if (state !== "unbilled" || !project) continue;
    const row = map.get(project.id) ?? { projectId: project.id, name: project.name, currency: project.currency, minutes: 0, amount: 0 };
    row.minutes += entry.minutes;
    row.amount += amountFor(entry.minutes, project.hourlyRate);
    map.set(project.id, row);
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes || (a.name < b.name ? -1 : 1));
}

export interface ProjectRow { projectId?: string; minutes: number; byState: Partial<Record<BillState, number>> }

/** This-week rows per project (biggest first). The running timer is added as a "live" slice of its project. */
export function projectBreakdown(items: ClassifiedEntry[], running?: { projectId?: string; minutes: number }): ProjectRow[] {
  const map = new Map<string, ProjectRow>();
  const add = (projectId: string | undefined, state: BillState, minutes: number) => {
    const key = projectId ?? "";
    const row = map.get(key) ?? { projectId, minutes: 0, byState: {} };
    row.minutes += minutes;
    row.byState[state] = (row.byState[state] ?? 0) + minutes;
    map.set(key, row);
  };
  for (const { entry, state } of items) add(entry.projectId, state, entry.minutes);
  if (running && running.minutes > 0) add(running.projectId, "live", running.minutes);
  return [...map.values()].sort((a, b) => b.minutes - a.minutes);
}

export const STATE_ORDER: BillState[] = ["unbilled", "invoiced", "paid", "fee", "live", "nonbill"];

/** Stable list of [state, minutes] in display order, zeros removed. */
export const stateSlices = (byState: Partial<Record<BillState, number>>): [BillState, number][] =>
  STATE_ORDER.flatMap((s) => (byState[s] ? [[s, byState[s] as number] as [BillState, number]] : []));

/** "3h 30m", "2h", "45m" (compact; formatDuration pads to "2h 00m"). */
export function shortDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h === 0 ? `${r}m` : r === 0 ? `${h}h` : `${h}h ${String(r).padStart(2, "0")}m`;
}
