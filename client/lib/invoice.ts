import { daysBetween, todayISO } from "./dates";
import type { Invoice, InvoiceLine, InvoiceStatus } from "./types";

export const lineAmount = (l: InvoiceLine): number => Math.round(l.qty * l.rate);

export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
}

/** Pure totals calculation. Tax applies after the (flat) discount. Never negative. */
export function calcTotals(inv: Pick<Invoice, "lines" | "taxPercent" | "discount" | "payments" | "status">): InvoiceTotals {
  const subtotal = inv.lines.reduce((s, l) => s + lineAmount(l), 0);
  const discount = Math.min(Math.max(inv.discount, 0), subtotal);
  const taxable = subtotal - discount;
  const tax = Math.round((taxable * Math.max(inv.taxPercent, 0)) / 100);
  const total = taxable + tax;
  const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
  const balance = inv.status === "written_off" || inv.status === "void" ? 0 : Math.max(total - paid, 0);
  return { subtotal, discount, taxable, tax, total, paid, balance };
}

/**
 * Status shown to people. `draft`, `written_off` and `void` are terminal/explicit and
 * always win. Otherwise: fully paid → paid; past due with a balance → overdue;
 * partly paid → partial; else unpaid.
 */
export function deriveStatus(inv: Invoice, today: string = todayISO()): InvoiceStatus {
  if (inv.status === "draft" || inv.status === "written_off" || inv.status === "void") return inv.status;
  const { total, paid } = calcTotals(inv);
  if (total > 0 && paid >= total) return "paid";
  if (daysBetween(today, inv.dueDate) > 0) return "overdue";
  return paid > 0 ? "partial" : "unpaid";
}

/** Whole days past due (0 when not overdue). */
export function daysOverdue(inv: Invoice, today: string = todayISO()): number {
  return Math.max(daysBetween(today, inv.dueDate), 0);
}

/** "INV-0042" */
export function formatInvoiceNumber(prefix: string, n: number): string {
  return `${prefix}${String(n).padStart(4, "0")}`;
}

/** Statuses on which actions like reminders and recording payments make sense. */
export const isLive = (s: InvoiceStatus) => s === "unpaid" || s === "partial" || s === "overdue";
