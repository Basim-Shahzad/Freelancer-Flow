import { daysBetween, fmtDate } from "@/lib/dates";
import type { FxRates } from "@/lib/api/mappers/exchange-rates";
import { convertForDisplay, ESTIMATE_LABEL } from "@/lib/fx";
import { formatMoney } from "@/lib/money";
import type { InvoiceView } from "@/lib/selectors";
import { CURRENCIES, type Currency, type ProjectWithSchedule, type TimeEntry } from "@/lib/types";
import { milestoneTotal } from "./logic";

/**
 * Pure "what is each project really paying me" helpers. Money is integer minor units.
 * Effective rate = fee ÷ billable hours logged (fixed, milestone and retainer work).
 * Currencies are never summed together; conversion is only used to ORDER rows, never shown.
 */

/** Below this many billable minutes an effective rate is noise, so we do not show one. */
export const MIN_RATE_MINUTES = 60;

export type ByCurrency = Partial<Record<Currency, number>>;
export type Verdict = "below" | "above" | "at";
export type RateSort = "worst" | "due" | "newest";
export type RateFilter = "open" | "finished" | "all";

export interface Floor {
  /** Minor units per hour in the PROJECT's currency. */
  amount: number;
  /** True when converted from another currency at the reference rate. */
  estimated: boolean;
  /** Date of the reference rate used (estimated floors only; null otherwise or when the API gave none). */
  asOf: string | null;
}
export interface OwnRate { hourlyRate?: number; defaultCurrency: Currency }

export const billableMinutes = (projectId: string, time: TimeEntry[]) =>
  time.reduce((s, t) => (t.projectId === projectId && t.billable ? s + t.minutes : s), 0);

/** Fee ÷ hours, minor units per hour. null when too little time is logged (or no fee). */
export function effectiveRate(fee: number, minutes: number): number | null {
  if (fee <= 0 || minutes < MIN_RATE_MINUTES) return null;
  return Math.round((fee * 60) / minutes);
}

/**
 * The user's own rate expressed in the project's currency (converted at the reference rate when needed).
 * null when there is no rate, or it cannot be converted (no rates loaded, or not a USD/PKR pair): the verdict is hidden, not guessed.
 */
export function floorFor(currency: Currency, own: OwnRate, rates?: FxRates | null): Floor | null {
  if (!own.hourlyRate || own.hourlyRate <= 0) return null;
  if (currency === own.defaultCurrency) return { amount: own.hourlyRate, estimated: false, asOf: null };
  const conv = convertForDisplay(own.hourlyRate, own.defaultCurrency, currency, rates);
  return conv ? { amount: conv.amount, estimated: true, asOf: conv.asOf } : null;
}

/** Minutes of work the fee buys at the floor rate. */
export const minutesFeeBuys = (fee: number, floor: number): number => (floor > 0 ? Math.round((fee / floor) * 60) : 0);

export function verdictOf(rate: number, floor: number): Verdict {
  return rate < floor ? "below" : rate > floor ? "above" : "at";
}

export const VERDICT_TEXT: Record<Verdict, string> = { below: "Below your rate.", above: "Above your rate.", at: "Right at your rate." };

/** Hours for prose: "118 h", "28.5 h". */
export const hoursText = (minutes: number) => `${Number((minutes / 60).toFixed(1))} h`;

/** What the project is billed as a total (null for plain hourly work, which has no fee). */
export function projectFee(p: ProjectWithSchedule, today: string): number | null {
  switch (p.billingType) {
    case "fixed": return p.budget ?? null;
    case "milestone": { const t = milestoneTotal(p.milestones); return t > 0 ? t : null; }
    case "retainer": { const t = p.retainerPeriods.filter((r) => r.start <= today).reduce((s, r) => s + r.amount, 0); return t > 0 ? t : null; }
    case "hourly": return null;
  }
}

/** Invoiced and not cancelled: drafts, voids and write-offs do not count as billed. */
export const billedOf = (views: InvoiceView[]) =>
  views.reduce((s, v) => (v.display === "draft" || v.display === "void" || v.display === "written_off" ? s : s + v.totals.total), 0);

export interface NextDue { date: string; label: string }

/** Draft, active and paused projects are open; completed, archived and cancelled ones are finished. */
const isOpen = (p: Pick<ProjectWithSchedule, "status">) => p.status === "draft" || p.status === "active" || p.status === "paused";

/** The nearest thing with a date on it: an unapproved milestone, the retainer period end, or an open invoice. */
export function nextDue(p: ProjectWithSchedule, views: InvoiceView[], today: string): NextDue | null {
  if (!isOpen(p)) return null;
  const c: NextDue[] = [];
  for (const m of p.milestones) if (m.status !== "approved" && m.dueDate) c.push({ date: m.dueDate, label: `“${m.title}”` });
  if (p.billingType === "retainer") {
    const cur = p.retainerPeriods.find((r) => r.start <= today && today <= r.end);
    if (cur) c.push({ date: cur.end, label: `${cur.label} ends` });
  }
  for (const v of views) if ((v.display === "unpaid" || v.display === "partial" || v.display === "overdue") && v.totals.balance > 0) c.push({ date: v.dueDate, label: `${v.number}` });
  if (c.length === 0) return null;
  return c.reduce((a, b) => (b.date < a.date ? b : a));
}

export interface RateRow {
  project: ProjectWithSchedule;
  kind: "fee" | "hourly";
  fee: number | null;
  minutes: number;
  /** Fee rows: effective rate. Hourly rows: the contract rate. Minor units per hour, project currency. */
  rate: number | null;
  floor: Floor | null;
  verdict: Verdict | null;
  /** Minutes the fee buys at the floor, and minutes logged beyond that (negative = to spare). Fee rows only. */
  buysMinutes: number | null;
  overMinutes: number | null;
  billed: number;
  notInvoiced: number;
  due: NextDue | null;
  /** Rate in the default currency, for ordering only. */
  sortRate: number | null;
  open: boolean;
}

/** Rate in the default currency, for ordering only; null (sorts last) when it cannot be converted. */
function sortRateOf(rate: number, from: Currency, to: Currency, rates?: FxRates | null): number | null {
  return from === to ? rate : (convertForDisplay(rate, from, to, rates)?.amount ?? null);
}

export function rateRow(p: ProjectWithSchedule, ctx: { time: TimeEntry[]; views: InvoiceView[]; today: string; own: OwnRate; unbilledHourly: number; rates?: FxRates | null }): RateRow {
  const views = ctx.views.filter((v) => v.projectId === p.id);
  const minutes = billableMinutes(p.id, ctx.time);
  const floor = floorFor(p.currency, ctx.own, ctx.rates);
  const billed = billedOf(views);
  const fee = projectFee(p, ctx.today);
  const hourly = p.billingType === "hourly";
  const rate = hourly ? (p.hourlyRate ?? null) : fee === null ? null : effectiveRate(fee, minutes);
  const verdict = rate !== null && floor ? verdictOf(rate, floor.amount) : null;
  const buys = !hourly && fee !== null && floor ? minutesFeeBuys(fee, floor.amount) : null;
  return {
    project: p, kind: hourly ? "hourly" : "fee", fee, minutes, rate, floor, verdict,
    buysMinutes: buys, overMinutes: buys === null ? null : minutes - buys,
    billed, notInvoiced: hourly ? ctx.unbilledHourly : Math.max((fee ?? 0) - billed, 0),
    due: nextDue(p, views, ctx.today),
    sortRate: rate === null ? null : sortRateOf(rate, p.currency, ctx.own.defaultCurrency, ctx.rates),
    open: isOpen(p),
  };
}

export const matchesRateFilter = (r: RateRow, f: RateFilter) => f === "all" || (f === "open" ? r.open : !r.open);

/** Stable ordering: worst effective rate first (rows with no rate last), soonest due first, newest start first. */
export function sortRateRows<T extends RateRow>(rows: T[], mode: RateSort): T[] {
  const byName = (a: T, b: T) => a.project.name.localeCompare(b.project.name);
  const out = [...rows];
  if (mode === "worst") {
    return out.sort((a, b) => {
      if (a.sortRate === null && b.sortRate === null) return byName(a, b);
      if (a.sortRate === null) return 1;
      if (b.sortRate === null) return -1;
      return a.sortRate - b.sortRate || byName(a, b);
    });
  }
  if (mode === "due") {
    return out.sort((a, b) => {
      if (!a.due && !b.due) return byName(a, b);
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due.date < b.due.date ? -1 : a.due.date > b.due.date ? 1 : byName(a, b);
    });
  }
  return out.sort((a, b) => (a.project.createdAt < b.project.createdAt ? 1 : a.project.createdAt > b.project.createdAt ? -1 : byName(a, b)));
}

/** Σ fee ÷ Σ hours per currency for open fee-based rows that have a usable rate. */
export function blendedByCurrency(rows: RateRow[]): ByCurrency {
  const fee: ByCurrency = {};
  const mins: ByCurrency = {};
  for (const r of rows) {
    if (!r.open || r.kind !== "fee" || r.fee === null || r.rate === null) continue;
    const c = r.project.currency;
    fee[c] = (fee[c] ?? 0) + r.fee;
    mins[c] = (mins[c] ?? 0) + r.minutes;
  }
  const out: ByCurrency = {};
  for (const c of CURRENCIES) {
    const rate = effectiveRate(fee[c] ?? 0, mins[c] ?? 0);
    if (rate !== null) out[c] = rate;
  }
  return out;
}

export function billedByCurrency(rows: RateRow[]): ByCurrency {
  const out: ByCurrency = {};
  for (const r of rows) if (r.open) out[r.project.currency] = (out[r.project.currency] ?? 0) + r.billed;
  return out;
}

/** One headline currency (the default's when present, else the first) plus the rest, never added together. */
export function splitByCurrency(by: ByCurrency, base: Currency): { primary: [Currency, number] | null; others: [Currency, number][] } {
  const entries = CURRENCIES.filter((c) => by[c] !== undefined).map((c): [Currency, number] => [c, by[c] ?? 0]);
  const primary = entries.find(([c]) => c === base) ?? entries[0] ?? null;
  return { primary, others: entries.filter((e) => e !== primary) };
}

/** "Fixed fee USD 36,000.00 · INV-0044 due 12 Oct" / "Hourly, USD 45.00 / h". */
export function billingSummary(r: RateRow): string {
  const p = r.project;
  const money = (n: number | undefined) => (n === undefined ? "not set" : formatMoney(n, p.currency));
  const head = p.billingType === "hourly" ? `Hourly, ${money(p.hourlyRate)} / h`
    : p.billingType === "retainer" ? `Retainer ${money(p.retainerAmount)} / month`
      : p.billingType === "milestone" ? `Milestones ${formatMoney(milestoneTotal(p.milestones), p.currency)}`
        : `Fixed fee ${money(p.budget)}`;
  return r.due ? `${head} · ${r.due.label} due ${fmtDate(r.due.date)}` : head;
}

/** "in 28 days" / "today" / "3 days ago". */
export function relativeDays(date: string, today: string): string {
  const n = daysBetween(date, today);
  if (n === 0) return "today";
  const abs = Math.abs(n);
  const unit = `${abs} ${abs === 1 ? "day" : "days"}`;
  return n > 0 ? `in ${unit}` : `${unit} ago`;
}

/** One plain sentence for the project page header. */
export function rateSentence(r: RateRow): string | null {
  const p = r.project;
  const cur = (n: number) => formatMoney(n, p.currency);
  if (r.kind === "hourly") {
    if (r.rate === null) return null;
    return `Billed at ${cur(r.rate)} an hour${r.notInvoiced > 0 ? `. ${cur(r.notInvoiced)} of work isn’t invoiced yet.` : "."}`;
  }
  if (r.rate === null) return r.fee === null ? null : `Log at least ${hoursText(MIN_RATE_MINUTES)} of billable time to see what this fee pays per hour.`;
  const parts = [`Paying ${cur(r.rate)} an hour at ${hoursText(r.minutes)}`];
  if (r.floor && r.verdict) {
    const diff = Math.abs(r.rate - r.floor.amount);
    parts[0] += r.verdict === "at" ? ", right at your rate" : ` — ${cur(diff)} ${r.verdict === "below" ? "below" : "above"} your ${cur(r.floor.amount)} rate${r.floor.estimated ? ` (${ESTIMATE_LABEL} · ref. rate ${r.floor.asOf ? fmtDate(r.floor.asOf) : "date unavailable"})` : ""}`;
  }
  const tail = r.notInvoiced > 0 && r.fee ? ` ${cur(r.notInvoiced)} of the ${cur(r.fee)} fee isn’t invoiced yet.` : "";
  return `${parts[0]}.${tail}`;
}
