import { daysBetween, fmtDate, fmtDateTime, todayISO } from "@/lib/dates";
import { EVENT_LABEL } from "@/lib/api/mappers/invoices";
import type { InvoiceDetail, InvoiceStatus, InvoiceTimelineEvent } from "@/lib/types";
import { dayWord, eventTone, type EventTone } from "./messages";

export interface TimelineItem {
  id: string;
  label: string;
  /** Pre-formatted date line. */
  when: string;
  /** A short extra line (the write-off reason, why an email failed). */
  detail?: string;
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
 * "What happened", oldest first. Built ONLY from the invoice's recorded facts: its creation, the server's events
 * (sent, viewed, reminders, payments, paid, write-off, cancelled, failed email). The one pending row is the invoice's
 * own due date, which is a known date, not a prediction.
 */
export function buildTimeline(invoice: Pick<InvoiceDetail, "createdAt" | "dueDate">, events: InvoiceTimelineEvent[], status: InvoiceStatus, today: string = todayISO()): TimelineItem[] {
  const items: TimelineItem[] = [
    { id: "created", label: "Created as a draft", when: fmtDateTime(invoice.createdAt), tone: "neutral", pending: false },
    ...events
      .slice()
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
      .map((e) => ({ id: e.id, label: EVENT_LABEL[e.type], when: fmtDateTime(e.at), detail: e.detail, tone: eventTone(e.type), pending: false })),
  ];
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
