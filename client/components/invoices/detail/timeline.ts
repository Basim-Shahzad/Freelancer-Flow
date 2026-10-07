import { daysBetween, fmtDate, fmtDateTime, todayISO } from "@/lib/dates";
import type { Invoice, InvoiceStatus } from "@/lib/types";
import { dayWord, eventTone, sortEvents, type EventTone } from "./messages";

export interface TimelineItem {
  id: string;
  label: string;
  /** Pre-formatted date line. */
  when: string;
  tone: EventTone;
  /** true = a known future/unsettled date, not something that happened. Drawn with a dashed dot. */
  pending: boolean;
}

/** "in 7 days", "today", "15 days ago". Whole calendar days. */
export function relativeDays(iso: string, today: string = todayISO()): string {
  const n = daysBetween(iso, today);
  if (n === 0) return "today";
  return n > 0 ? `in ${dayWord(n)}` : `${dayWord(-n)} ago`;
}

const STATUSES_WITH_DUE: InvoiceStatus[] = ["unpaid", "partial", "overdue"];

/**
 * "What happened", oldest first. Built ONLY from recorded events (created, sent, viewed, reminders,
 * payments, reversals, write-off, void). The one pending row is the invoice's own due date, which is a
 * known date, not a prediction. Internal "edited" events are left out.
 */
export function buildTimeline(invoice: Invoice, status: InvoiceStatus, today: string = todayISO()): TimelineItem[] {
  const items: TimelineItem[] = sortEvents(invoice.events)
    .reverse()
    .filter((e) => e.type !== "edited")
    .map((e) => ({ id: e.id, label: e.label, when: fmtDateTime(e.at), tone: eventTone(e.type), pending: false }));
  if (STATUSES_WITH_DUE.includes(status)) {
    items.push({
      id: "due",
      label: status === "overdue" ? "Payment was due" : "Payment due",
      when: `${fmtDate(invoice.dueDate)} · ${relativeDays(invoice.dueDate, today)}`,
      tone: status === "overdue" ? "err" : "neutral",
      pending: true,
    });
  }
  return items;
}
