import type { InvoiceEvent, InvoiceEventType, InvoiceStatus } from "@/lib/types";

/** Pure helpers for the invoice detail screen: share/reminder copy, wa.me links, event ordering. */

export type Tone = "polite" | "firm" | "final";

export const firstName = (full: string) => full.trim().split(/\s+/)[0] || full.trim();

export const shareLink = (origin: string, token: string) => `${origin}/i/${token}`;

/** wa.me link: digits only, no "+" or spaces. Without a number WhatsApp lets the user pick a chat. */
export function whatsappUrl(phone: string | undefined, text: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export interface ReminderInput {
  tone: Tone;
  /** Client contact's name (first name is used). */
  contactName: string;
  /** Sender (freelancer) name used as the sign-off. */
  ownerName: string;
  number: string;
  /** Formatted outstanding amount, e.g. "USD 1,250.00". */
  amount: string;
  /** Formatted due date. */
  dueDate: string;
  overdueDays: number;
  link: string;
}

/** Tone-appropriate reminder text. Always names the invoice, amount, due date and share link; no payment button. */
export function reminderMessage(i: ReminderInput): string {
  const hi = `Hi ${firstName(i.contactName)},`;
  const sign = firstName(i.ownerName);
  const overdue = i.overdueDays > 0;
  const days = `${i.overdueDays} ${i.overdueDays === 1 ? "day" : "days"}`;
  const state = overdue ? `was due on ${i.dueDate}` : `is due on ${i.dueDate}`;
  const inv = `invoice ${i.number} for ${i.amount}`;
  switch (i.tone) {
    case "polite":
      return `${hi} a gentle reminder that ${inv} ${state}. You can see the payment details here: ${i.link}. Thank you. ${sign}`;
    case "firm":
      return `${hi} following up: ${inv} ${overdue ? `${state} and is now ${days} overdue` : state}. Please arrange payment, or let me know if something is holding it up. Payment details: ${i.link}. Thanks, ${sign}`;
    case "final":
      return `${hi} this is a final reminder that ${inv} ${overdue ? `${state} and is ${days} overdue` : state}. Please pay as soon as you can, or reply if it is already on its way. Payment details: ${i.link}. Thank you, ${sign}`;
  }
}

export function shareMessage(i: { contactName: string; ownerName: string; businessName: string; number: string; amount: string; dueDate: string; link: string }): string {
  return `Hi ${firstName(i.contactName)}, here is invoice ${i.number} from ${i.businessName} for ${i.amount}, due ${i.dueDate}. Payment details are here: ${i.link}. Thank you. ${firstName(i.ownerName)}`;
}

/* ------------------------------------------------------------------- timeline */

export type EventTone = "neutral" | "ok" | "warn" | "err" | "gold";

/** Gold is reserved for the Paid moment. */
export function eventTone(type: InvoiceEventType): EventTone {
  switch (type) {
    case "payment": return "ok";
    case "paid": return "gold";
    case "written_off": return "warn";
    case "overdue": return "err";
    default: return "neutral";
  }
}

/** Tie-break for events with the same timestamp: later lifecycle stages sort first (newest-first list). */
const RANK: Record<InvoiceEventType, number> = {
  created: 0, sent: 1, viewed: 2, edited: 3, reminder: 4, overdue: 5, payment: 6, payment_reversed: 7, paid: 8, write_off_reversed: 9, written_off: 10, void: 11,
};

/** Newest first. */
export function sortEvents(events: InvoiceEvent[]): InvoiceEvent[] {
  return events.slice().sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : RANK[b.type] - RANK[a.type]));
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
    case "void": return "Void · this invoice can’t be paid or edited";
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
    case "void": return "Void. This invoice can’t be paid or edited.";
  }
}
