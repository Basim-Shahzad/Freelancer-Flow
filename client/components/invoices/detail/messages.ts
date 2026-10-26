import type { ApiInvoiceEventType } from "@/lib/api/invoices.types";
import type { InvoiceStatus } from "@/lib/types";

/** Pure copy helpers for the invoice detail screen. The share and reminder texts come from the server (`whatsappUrl`). */

export type EventTone = "neutral" | "ok" | "warn" | "err" | "gold";

/** Gold is reserved for the Paid moment. */
export function eventTone(type: ApiInvoiceEventType): EventTone {
  switch (type) {
    case "PAYMENT_RECORDED": return "ok";
    case "PAID": return "gold";
    case "WRITTEN_OFF": return "warn";
    case "EMAIL_FAILED": return "err";
    default: return "neutral";
  }
}

export const dayWord = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

export function statusCaption(status: InvoiceStatus, o: { paid: string; balance: string; overdueDays: number; paidDate: string }): string {
  switch (status) {
    case "draft": return "Draft · not visible to your client yet";
    case "unpaid": return "Instructions shared · waiting for payment";
    case "partial": return `${o.paid} received · ${o.balance} to go`;
    case "overdue": return `Payment is ${dayWord(o.overdueDays)} late`;
    case "paid": return `Paid in full · ${o.paidDate}`;
    case "written_off": return "Written off · no longer counted as outstanding";
    case "void": return "Cancelled · this invoice can’t be paid or edited";
  }
}

/** The one data-driven sentence under the invoice title, e.g. "USD 7,043.75 to Ithra Labs for " + project + ". Due in 23 days." */
export function claimTail(status: InvoiceStatus, o: { paid: string; balance: string; dueDate: string; overdueDays: number; daysToDue: number; paidDate: string; daysToPay: number }): string {
  const due = o.daysToDue > 0 ? `Due in ${dayWord(o.daysToDue)}.` : "Due today.";
  switch (status) {
    case "draft": return "Still a draft. Your client hasn’t seen it.";
    case "unpaid": return due;
    case "partial": return `${o.paid} received, ${o.balance} to go. ${due}`;
    case "overdue": return `Due ${o.dueDate} · ${dayWord(o.overdueDays)} overdue.`;
    case "paid": return `Paid ${o.paidDate}${o.daysToPay >= 0 ? `, ${dayWord(o.daysToPay)} after issue` : ""}.`;
    case "written_off": return "Written off. It no longer counts as outstanding.";
    case "void": return "Cancelled. This invoice can’t be paid or edited.";
  }
}
