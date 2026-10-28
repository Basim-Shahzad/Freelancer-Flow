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

/* ------------------------------------------------- server-shaped preview totals */

export interface PreviewTax {
  /** Percent as typed or as the server sends it ("15", "7.5"). */
  rate: string;
  isInclusive?: boolean;
  isCompound?: boolean;
  isWithholding?: boolean;
}

export interface PreviewTotals {
  subtotal: number;
  discountAmount: number;
  /** One amount per tax, in the order given. */
  taxLines: number[];
  taxAmount: number;
  withholdingAmount: number;
  total: number;
}

const ZERO = BigInt(0);
const TWO = BigInt(2);
const RATE_SCALE = BigInt(10_000);
const PERCENT = BigInt(100) * RATE_SCALE;

/** "7.5" -> 75000 (four decimals, like the server's rate columns); null when it is not a number. */
function scaledRate(s: string): bigint | null {
  const t = s.trim() === "" ? "0" : s.trim();
  const m = /^(\d+)(?:\.(\d{0,4})\d*)?$/.exec(t);
  return m ? BigInt((m[1] ?? "0") + (m[2] ?? "").padEnd(4, "0")) : null;
}

const roundDiv = (n: bigint, d: bigint): bigint => (TWO * n + d) / (TWO * d); // half up, non-negative

/**
 * The live preview of the server's `compute_totals` (`app/services/invoicing.py`), in integer minor units with
 * exact BigInt maths: discount first, inclusive tax extracted, exclusive added, compound stacked, withholding
 * subtracted, each amount rounded half up. The server's numbers are the truth; this only mirrors them for the preview.
 */
export function previewTotals(subtotal: number, discountRate: string, taxes: PreviewTax[]): PreviewTotals {
  const sub = BigInt(Math.max(Math.round(subtotal), 0));
  const discount = roundDiv(sub * (scaledRate(discountRate) ?? ZERO), PERCENT);
  const discounted = sub - discount;
  const rates = taxes.map((t) => scaledRate(t.rate) ?? ZERO);
  const inclusive = taxes.reduce((s, t, i) => (t.isInclusive ? s + (rates[i] ?? ZERO) : s), ZERO);
  // The net is the fraction num / den (den > PERCENT only when an inclusive tax is extracted).
  const den = PERCENT + inclusive;
  const num = discounted * PERCENT;
  let running = ZERO;
  const amounts = taxes.map((t, i) => {
    const baseNum = t.isCompound && !t.isInclusive ? num + running * den : num;
    const amount = roundDiv(baseNum * (rates[i] ?? ZERO), den * PERCENT);
    if (!t.isInclusive && !t.isWithholding) running += amount;
    return amount;
  });
  const sumWhere = (pick: (t: PreviewTax) => boolean) => amounts.reduce((s, a, i) => (pick(taxes[i] as PreviewTax) ? s + a : s), ZERO);
  const collected = sumWhere((t) => !t.isWithholding);
  const withholding = sumWhere((t) => !!t.isWithholding);
  const exclusive = sumWhere((t) => !t.isWithholding && !t.isInclusive);
  return {
    subtotal: Number(sub), discountAmount: Number(discount), taxLines: amounts.map(Number), taxAmount: Number(collected),
    withholdingAmount: Number(withholding), total: Number(discounted + exclusive - withholding),
  };
}

/** Statuses on which actions like reminders and recording payments make sense. */
export const isLive = (s: InvoiceStatus) => s === "unpaid" || s === "partial" || s === "overdue";
