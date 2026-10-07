import { daysBetween } from "@/lib/dates";
import { unbilledOf } from "@/components/projects/logic";
import type { InvoiceView } from "@/lib/selectors";
import { CURRENCIES, type Currency, type Project, type TimeEntry } from "@/lib/types";
import { monthRange } from "./aggregate";

/**
 * "Owed to you" pipeline, aggregated PER CURRENCY (minor units are never summed across currencies).
 * Stages: not billed yet, drafted, out with clients (sent, inside terms), past due, landed this month.
 */

export interface StageFigure { amount: number; count: number }
export interface CurrencyStages {
  currency: Currency;
  /** Unbilled hourly time and ready-to-invoice items (approved milestones, started retainer periods). An estimate. */
  unbilled: StageFigure & { minutes: number; items: number };
  drafted: StageFigure;
  out: StageFigure & { nextDue?: string };
  late: StageFigure & { oldestDays: number };
  /** Payments recorded this calendar month. `count` = number of payments. */
  landed: StageFigure;
  /** Sent and not yet paid: out + late. */
  owed: number;
}

const blank = (currency: Currency): CurrencyStages => ({
  currency,
  unbilled: { amount: 0, count: 0, minutes: 0, items: 0 },
  drafted: { amount: 0, count: 0 },
  out: { amount: 0, count: 0 },
  late: { amount: 0, count: 0, oldestDays: 0 },
  landed: { amount: 0, count: 0 },
  owed: 0,
});

export function stagesByCurrency(views: InvoiceView[], projects: Project[], time: TimeEntry[], today: string): Partial<Record<Currency, CurrencyStages>> {
  const out: Partial<Record<Currency, CurrencyStages>> = {};
  const get = (c: Currency) => (out[c] ??= blank(c));
  const month = monthRange(today);

  for (const p of projects) {
    if (p.status === "completed") continue;
    const u = unbilledOf(p, time, today);
    if (u.amount <= 0) continue;
    const s = get(p.currency).unbilled;
    s.amount += u.amount;
    s.minutes += u.minutes;
    s.items += u.items;
    s.count += 1;
  }

  for (const v of views) {
    const s = get(v.currency);
    if (v.display === "draft") { s.drafted.amount += v.totals.total; s.drafted.count += 1; }
    else if (v.display === "unpaid" || v.display === "partial") {
      s.out.amount += v.totals.balance;
      s.out.count += 1;
      if (!s.out.nextDue || v.dueDate < s.out.nextDue) s.out.nextDue = v.dueDate;
    } else if (v.display === "overdue") {
      s.late.amount += v.totals.balance;
      s.late.count += 1;
      s.late.oldestDays = Math.max(s.late.oldestDays, daysBetween(today, v.dueDate));
    }
    for (const p of v.payments) {
      if (p.date >= month.from && p.date <= month.to) { s.landed.amount += p.amount; s.landed.count += 1; }
    }
  }

  for (const s of Object.values(out)) s.owed = s.out.amount + s.late.amount;
  return out;
}

/** Currencies that have any figure, in stable order, with `base` first when present. */
export function activeCurrencies(by: Partial<Record<Currency, CurrencyStages>>, base: Currency): Currency[] {
  const used = CURRENCIES.filter((c) => {
    const s = by[c];
    return s && (s.unbilled.amount || s.drafted.amount || s.owed || s.landed.amount);
  });
  if (used.length === 0) return [base];
  return used.includes(base) ? [base, ...used.filter((c) => c !== base)] : used;
}

/** Average whole days from issue date to the final payment, across fully paid invoices. null when none. */
export function sentToPaidDays(views: InvoiceView[]): { days: number; n: number } | null {
  const spans: number[] = [];
  for (const v of views) {
    if (v.display !== "paid" || v.payments.length === 0) continue;
    const last = v.payments.reduce((m, p) => (p.date > m ? p.date : m), "");
    spans.push(Math.max(0, daysBetween(last, v.issueDate)));
  }
  if (spans.length === 0) return null;
  return { days: Math.round(spans.reduce((a, b) => a + b, 0) / spans.length), n: spans.length };
}
