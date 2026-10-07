import { addToBy, type ByCurrency } from "@/components/dashboard/aggregate";
import { effectiveRate, type RateRow } from "@/components/projects/rate";
import { daysBetween } from "@/lib/dates";
import { convertMinor } from "@/lib/fx";
import type { InvoiceView } from "@/lib/selectors";
import { CURRENCIES, type Client, type Currency } from "@/lib/types";

export type ClientFilter = "all" | "owes" | "overdue";

export interface ClientAccount {
  billed: ByCurrency;
  paid: ByCurrency;
  outstanding: ByCurrency;
  overdue: ByCurrency;
  owes: boolean;
  isOverdue: boolean;
}

/** Per-currency account for one client, from their invoices (drafts and voids are not billed). */
export function clientAccount(clientId: string, views: InvoiceView[]): ClientAccount {
  const acc: ClientAccount = { billed: {}, paid: {}, outstanding: {}, overdue: {}, owes: false, isOverdue: false };
  for (const v of views) {
    if (v.clientId !== clientId) continue;
    if (v.display !== "draft" && v.display !== "void") {
      addToBy(acc.billed, v.currency, v.totals.total);
      addToBy(acc.paid, v.currency, v.totals.paid);
    }
    if (v.display === "unpaid" || v.display === "partial" || v.display === "overdue") {
      addToBy(acc.outstanding, v.currency, v.totals.balance);
      acc.owes = acc.owes || v.totals.balance > 0;
    }
    if (v.display === "overdue") {
      addToBy(acc.overdue, v.currency, v.totals.balance);
      acc.isOverdue = true;
    }
  }
  return acc;
}

export function matchesClient(c: Client, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [c.name, c.contactName, c.city, c.country, c.email].some((f) => f.toLowerCase().includes(s));
}

export function matchesFilter(acc: ClientAccount, filter: ClientFilter): boolean {
  return filter === "all" || (filter === "owes" ? acc.owes : acc.isOverdue);
}

/** Whole days from issue date to the last payment, for an invoice that is fully paid; otherwise null. */
export function daysToPay(v: InvoiceView): number | null {
  if (v.totals.total <= 0 || v.totals.paid < v.totals.total || v.payments.length === 0) return null;
  const last = v.payments.reduce((m, p) => (p.date > m ? p.date : m), v.payments[0]?.date ?? v.issueDate);
  return Math.max(daysBetween(last, v.issueDate), 0);
}

/** Mean days-to-pay over paid invoices (optionally for one client), one decimal. null when nothing has been paid. */
export function avgDaysToPay(views: InvoiceView[], clientId?: string): number | null {
  const days = views.filter((v) => (!clientId || v.clientId === clientId) && v.display === "paid").map(daysToPay).filter((d): d is number => d !== null);
  return days.length === 0 ? null : Math.round((days.reduce((s, d) => s + d, 0) / days.length) * 10) / 10;
}

export const daysText = (d: number) => `${Number.isInteger(d) ? d : d.toFixed(1)} d`;

export type ClientSort = "worth" | "fastest" | "lifetime";

export interface Worth { amount: number; currency: Currency }

/**
 * What an hour with this client is really worth: fee ÷ hours on fee-based projects and the contract
 * rate on hourly ones, pooled within ONE currency (the client's own when present, else the first found).
 */
export function clientWorth(rows: RateRow[], preferred: Currency): Worth | null {
  const rev: Partial<Record<Currency, number>> = {};
  const mins: Partial<Record<Currency, number>> = {};
  for (const r of rows) {
    if (r.minutes <= 0 || r.rate === null) continue;
    const c = r.project.currency;
    rev[c] = (rev[c] ?? 0) + (r.kind === "fee" ? (r.fee ?? 0) : (r.rate * r.minutes) / 60);
    mins[c] = (mins[c] ?? 0) + r.minutes;
  }
  const cur = rev[preferred] !== undefined ? preferred : CURRENCIES.find((c) => rev[c] !== undefined);
  if (!cur) return null;
  const rate = effectiveRate(Math.round(rev[cur] ?? 0), mins[cur] ?? 0);
  return rate === null ? null : { amount: rate, currency: cur };
}

export interface ClientRow { client: Client; acc: ClientAccount; worth: Worth | null; days: number | null; lifetime: ByCurrency }

/** Sort by worth per hour, pay speed or lifetime billed. Missing data sorts last; foreign currencies are converted for ORDER only. */
export function sortClientRows<T extends ClientRow>(rows: T[], mode: ClientSort, base: Currency): T[] {
  const toBase = (by: ByCurrency) => CURRENCIES.reduce((s, c) => s + (by[c] ? convertMinor(by[c] ?? 0, c, base) : 0), 0);
  const key = (r: T): number | null =>
    mode === "worth" ? (r.worth ? convertMinor(r.worth.amount, r.worth.currency, base) : null)
      : mode === "fastest" ? r.days
        : toBase(r.lifetime) || null;
  const asc = mode === "fastest";
  return [...rows].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    if (x === null && y === null) return a.client.name.localeCompare(b.client.name);
    if (x === null) return 1;
    if (y === null) return -1;
    return (asc ? x - y : y - x) || a.client.name.localeCompare(b.client.name);
  });
}

/** Number of clients with at least one overdue invoice. */
export const overdueClientCount = (rows: { acc: ClientAccount }[]) => rows.filter((r) => r.acc.isOverdue).length;
