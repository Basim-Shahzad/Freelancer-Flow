import { addMonths, endOfMonth, startOfMonth } from "date-fns";
import { daysBetween, isoDate, parse } from "@/lib/dates";
import { daysOverdue } from "@/lib/invoice";
import { unbilledOf } from "@/components/projects/logic";
import type { InvoiceView } from "@/lib/selectors";
import { CURRENCIES, type Currency, type Payment, type Project, type TimeEntry } from "@/lib/types";

/** Pure dashboard aggregations over store slices. All amounts are minor units. */

export type ByCurrency = Partial<Record<Currency, number>>;

const add = (by: ByCurrency, cur: Currency, amount: number) => { by[cur] = (by[cur] ?? 0) + amount; };

/** Non-zero entries in a stable currency order. */
export function currencyEntries(by: ByCurrency): [Currency, number][] {
  return CURRENCIES.filter((c) => (by[c] ?? 0) !== 0).map((c) => [c, by[c] ?? 0]);
}

export interface DateRange { from: string; to: string }

/** Calendar month containing `today`, shifted by `offset` months (-1 = last month). */
export function monthRange(today: string, offset = 0): DateRange {
  const d = addMonths(parse(today), offset);
  return { from: isoDate(startOfMonth(d)), to: isoDate(endOfMonth(d)) };
}

/** Recorded payments dated inside the range, by invoice currency. */
export function cashIn(views: InvoiceView[], range: DateRange): ByCurrency {
  const out: ByCurrency = {};
  for (const v of views) {
    for (const p of v.payments) if (p.date >= range.from && p.date <= range.to) add(out, v.currency, p.amount);
  }
  return out;
}

export function outstandingBy(views: InvoiceView[]): { by: ByCurrency; count: number } {
  const by: ByCurrency = {};
  let count = 0;
  for (const v of views) {
    if (v.display === "unpaid" || v.display === "partial" || v.display === "overdue") { add(by, v.currency, v.totals.balance); count += 1; }
  }
  return { by, count };
}

export function overdueBy(views: InvoiceView[]): { by: ByCurrency; items: InvoiceView[] } {
  const by: ByCurrency = {};
  const items = views.filter((v) => v.display === "overdue");
  for (const v of items) add(by, v.currency, v.totals.balance);
  items.sort((a, b) => daysOverdue(b) - daysOverdue(a));
  return { by, items };
}

export interface PaymentRow { invoice: InvoiceView; payment: Payment }

export function recentPayments(views: InvoiceView[], limit = 6): PaymentRow[] {
  const rows = views.flatMap((invoice) => invoice.payments.map((payment) => ({ invoice, payment })));
  rows.sort((a, b) => (a.payment.date === b.payment.date ? (a.payment.recordedAt < b.payment.recordedAt ? 1 : -1) : a.payment.date < b.payment.date ? 1 : -1));
  return rows.slice(0, limit);
}

export type AttentionReason = "overdue" | "due_soon" | "draft";
export interface AttentionItem { view: InvoiceView; reason: AttentionReason; days: number }

/** Overdue first (most late first), then due within 3 days, then unsent drafts. */
export function attentionInvoices(views: InvoiceView[], today: string, limit = 5): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const v of views) {
    if (v.display === "overdue") items.push({ view: v, reason: "overdue", days: daysBetween(today, v.dueDate) });
    else if (v.display === "unpaid" || v.display === "partial") {
      const left = daysBetween(v.dueDate, today);
      if (left >= 0 && left <= 3) items.push({ view: v, reason: "due_soon", days: left });
    } else if (v.display === "draft") items.push({ view: v, reason: "draft", days: 0 });
  }
  const rank: Record<AttentionReason, number> = { overdue: 0, due_soon: 1, draft: 2 };
  items.sort((a, b) => rank[a.reason] - rank[b.reason] || (a.reason === "overdue" ? b.days - a.days : a.days - b.days));
  return items.slice(0, limit);
}

export interface UnbilledSummary { by: ByCurrency; minutes: number; items: number; projects: number }

export function unbilledSummary(projects: Project[], time: TimeEntry[], today: string): UnbilledSummary {
  const by: ByCurrency = {};
  let minutes = 0;
  let items = 0;
  let count = 0;
  for (const p of projects) {
    if (p.status === "completed") continue;
    const u = unbilledOf(p, time, today);
    if (u.amount <= 0) continue;
    add(by, p.currency, u.amount);
    minutes += u.minutes;
    items += u.items;
    count += 1;
  }
  return { by, minutes, items, projects: count };
}

/** Where to show an ≈ estimate for a currency: the opposite of the business default. */
export function estimateTarget(currency: Currency, base: Currency): Currency {
  if (currency !== base) return base;
  return base === "PKR" ? "USD" : "PKR";
}

export { add as addToBy };
