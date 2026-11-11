import { daysBetween, fmtDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { InvoiceDetail, InvoiceStatus, Milestone, PaymentMethodKind } from "@/lib/types";

export const firstName = (full: string | undefined, fallback = "the freelancer") => full?.trim().split(/\s+/)[0] || fallback;

export const MILESTONE_STATE_LABEL: Record<Milestone["status"], string> = {
  pending: "Upcoming",
  in_progress: "In progress",
  submitted: "Needs you",
  approved: "Approved",
  rejected: "Changes requested",
};

/** Whether the client can decide on the milestone (the API answers 400 otherwise). */
export const isDecidable = (m: Milestone) => m.status === "submitted";

/** One line under the invoice number: "Due 20 Sep 2026 · 15 days overdue". */
export function dueLine(inv: InvoiceDetail, display: InvoiceStatus, today: string = todayISO()): string {
  if (display === "paid") return `Paid ${fmtDate(lastPaymentDate(inv) ?? inv.dueDate)}`;
  if (display === "written_off") return "Closed";
  if (display === "overdue") {
    const n = Math.max(0, daysBetween(today, inv.dueDate));
    return `Due ${fmtDate(inv.dueDate)} · ${n} ${n === 1 ? "day" : "days"} overdue`;
  }
  return daysBetween(today, inv.dueDate) === 0 ? "Due today" : `Due ${fmtDate(inv.dueDate)}`;
}

export function lastPaymentDate(inv: InvoiceDetail): string | undefined {
  return inv.payments.map((p) => p.paidAt.slice(0, 10)).sort().at(-1);
}

export interface InvoiceHero {
  label: string;
  amount: number;
  /** Show a labelled estimate in the other reference currency. */
  estimate: boolean;
}

export function invoiceHero(inv: InvoiceDetail, display: InvoiceStatus): InvoiceHero {
  if (display === "paid") return { label: "Amount paid", amount: inv.total, estimate: false };
  if (display === "written_off") return { label: "Invoice total", amount: inv.total, estimate: false };
  if (display === "partial") return { label: "Balance due", amount: inv.balanceDue, estimate: true };
  return { label: "Amount due", amount: inv.balanceDue, estimate: true };
}

export function invoiceCaption(inv: InvoiceDetail, display: InvoiceStatus): string {
  if (display === "paid") return `Paid in full · ${fmtDate(lastPaymentDate(inv))}`;
  if (display === "partial") return `${formatMoney(inv.amountPaid, inv.currency)} received · ${formatMoney(inv.balanceDue, inv.currency)} to go`;
  if (display === "overdue") return "This invoice is past its due date";
  if (display === "written_off") return "This invoice is closed";
  return "Pay the freelancer directly, using the details below";
}

/** Only http(s) links are rendered as outbound links. */
export function safeHttpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Short client-facing line under a method title. */
export const CLIENT_INTRO: Partial<Record<PaymentMethodKind, string>> = {
  payoneer: "Fastest if you already use Payoneer.",
  esfca: "Send as “export of IT services”. Fees depend on your bank.",
  wise: "Send from Wise to the IBAN below.",
  raast: "Instant transfer from any Raast-enabled bank or wallet.",
  pkrbank: "Local transfer in rupees.",
};
