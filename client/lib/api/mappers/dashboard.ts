import type { CurrencyAmount, DashboardSummary } from "@/lib/api/dashboard.types";
import { toMinor } from "@/lib/api/money";
import { CURRENCIES, type Currency } from "@/lib/types";

export type ByCurrency = Partial<Record<Currency, number>>;

export interface OutstandingView { balance: number; count: number; overdueBalance: number; overdueCount: number }
export interface UnbilledTimeView { projectId: string; projectName: string; currency: Currency; minutes: number; amount: number }
export interface UnbilledMilestonesView { projectId: string; projectName: string; currency: Currency; count: number; amount: number }
export interface UnbilledPeriodView { projectId: string; projectName: string; currency: Currency; periodStart: string; periodEnd: string; label: string; amount: number }

export interface RunningTimerView { id: string; projectId: string; projectName: string; description: string; startAt: string; elapsedMinutes: number }

export interface DashboardView {
  cashIn: { thisMonth: ByCurrency; lastMonth: ByCurrency; thisMonthStart: string; lastMonthStart: string; timezone: string };
  outstanding: Partial<Record<Currency, OutstandingView>>;
  unbilled: {
    time: UnbilledTimeView[];
    milestones: UnbilledMilestonesView[];
    retainerPeriods: UnbilledPeriodView[];
    byCurrency: ByCurrency;
    minutes: number;
  };
  runningTimer: RunningTimerView | null;
  activeProjects: number;
  /** True when there is nothing at all to show (no money, no unbilled work, no timer, no active projects). */
  isEmpty: boolean;
}

const asCurrency = (c: string | null | undefined): Currency | undefined => (CURRENCIES as string[]).includes(c ?? "") ? (c as Currency) : undefined;

/** "12.5" / "0.25" hours -> whole minutes, by string arithmetic (no float math). */
export function hoursToMinutes(hours: string): number {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(hours.trim());
  if (!m) return 0;
  const frac = (m[2] ?? "").padEnd(4, "0").slice(0, 4);
  return Number(m[1]) * 60 + Math.round((Number(frac) * 60) / 10_000);
}

function sumBy(rows: CurrencyAmount[]): ByCurrency {
  const by: ByCurrency = {};
  for (const r of rows) {
    const c = asCurrency(r.currency);
    if (c) by[c] = (by[c] ?? 0) + toMinor(r.amount, c);
  }
  return by;
}

/**
 * Summary -> view model. A null `currency` on an unbilled row falls back to the project's (via `projectCurrency`);
 * with no match the row is skipped so currencies are never mixed.
 */
export function mapDashboardSummary(res: DashboardSummary, projectCurrency: (projectId: string) => Currency | undefined = () => undefined): DashboardView {
  const cur = (c: string | null | undefined, projectId: string) => asCurrency(c) ?? projectCurrency(projectId);
  const outstanding: DashboardView["outstanding"] = {};
  for (const o of res.outstanding?.byCurrency ?? []) {
    const c = asCurrency(o.currency);
    if (c) outstanding[c] = { balance: toMinor(o.balance, c), count: o.count, overdueBalance: toMinor(o.overdueBalance, c), overdueCount: o.overdueCount };
  }

  const time: UnbilledTimeView[] = [];
  const milestones: UnbilledMilestonesView[] = [];
  const retainerPeriods: UnbilledPeriodView[] = [];
  const byCurrency: ByCurrency = {};
  let minutes = 0;
  const add = (c: Currency, amount: number) => { byCurrency[c] = (byCurrency[c] ?? 0) + amount; };

  for (const t of res.unbilled?.time ?? []) {
    const c = cur(t.currency, t.projectId);
    if (!c) continue;
    const row = { projectId: t.projectId, projectName: t.projectName, currency: c, minutes: hoursToMinutes(t.hours), amount: toMinor(t.amount, c) };
    time.push(row);
    minutes += row.minutes;
    add(c, row.amount);
  }
  for (const m of res.unbilled?.milestones ?? []) {
    const c = cur(m.currency, m.projectId);
    if (!c) continue;
    const row = { projectId: m.projectId, projectName: m.projectName, currency: c, count: m.count, amount: toMinor(m.amount, c) };
    milestones.push(row);
    add(c, row.amount);
  }
  for (const p of res.unbilled?.retainerPeriods ?? []) {
    const c = cur(p.currency, p.projectId);
    if (!c) continue;
    const row = { projectId: p.projectId, projectName: p.projectName, currency: c, periodStart: p.periodStart, periodEnd: p.periodEnd, label: p.label, amount: toMinor(p.amount, c) };
    retainerPeriods.push(row);
    add(c, row.amount);
  }

  const cashIn = {
    thisMonth: sumBy(res.cashIn?.thisMonth ?? []),
    lastMonth: sumBy(res.cashIn?.lastMonth ?? []),
    thisMonthStart: res.cashIn?.thisMonthStart ?? "",
    lastMonthStart: res.cashIn?.lastMonthStart ?? "",
    timezone: res.cashIn?.timezone ?? "",
  };
  const t = res.runningTimer;
  const runningTimer = t ? { id: t.id, projectId: t.projectId, projectName: t.projectName, description: t.description, startAt: t.startTime, elapsedMinutes: t.elapsedMinutes } : null;
  const isEmpty = Object.keys(outstanding).length === 0 && Object.keys(byCurrency).length === 0 && Object.keys(cashIn.thisMonth).length === 0
    && Object.keys(cashIn.lastMonth).length === 0 && !runningTimer && res.activeProjects === 0;
  return { cashIn, outstanding, unbilled: { time, milestones, retainerPeriods, byCurrency, minutes }, runningTimer, activeProjects: res.activeProjects ?? 0, isEmpty };
}
