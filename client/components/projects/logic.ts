import { addMonths, endOfMonth, format, startOfMonth, startOfWeek } from "date-fns";
import { daysBetween, fmtDate, isoDate, parse } from "@/lib/dates";
import { isLive } from "@/lib/invoice";
import { formatHours, formatMoney, formatDuration } from "@/lib/money";
import type { InvoiceView } from "@/lib/selectors";
import type { Stage } from "@/components/domain/stage-thread";
import type { BillingType, Currency, Project, RetainerPeriod, TimeEntry } from "@/lib/types";

/** Pure project helpers: stage derivation, progress, unbilled work, summaries. */

export const BILLING_LABEL: Record<BillingType, string> = {
  fixed: "Fixed price",
  hourly: "Hourly",
  retainer: "Retainer",
  milestone: "Milestones",
};

export const STATUS_LABEL: Record<Project["status"], string> = { active: "Active", paused: "Paused", completed: "Completed" };

const STAGE_ORDER: Stage[] = ["work", "approval", "invoice", "instructions", "paid"];

export const milestoneTotal = (p: Project) => p.milestones.reduce((s, m) => s + m.amount, 0);

/** "USD 45.00 / h", "USD 1,300.00 / month", "PKR 370,000 total". */
export function rateLabel(p: Project): string {
  switch (p.billingType) {
    case "hourly": return p.hourlyRate !== undefined ? `${formatMoney(p.hourlyRate, p.currency)} / h` : "Rate not set";
    case "retainer": return p.retainerAmount !== undefined ? `${formatMoney(p.retainerAmount, p.currency)} / month` : "Amount not set";
    case "fixed": return p.fixedAmount !== undefined ? formatMoney(p.fixedAmount, p.currency) : "Price not set";
    case "milestone": return `${formatMoney(milestoneTotal(p), p.currency)} total`;
  }
}

/** Invoices that count as "invoiced" (everything sent or settled; not drafts or voids). */
const isInvoiced = (v: InvoiceView) => v.display !== "draft" && v.display !== "void";
export const invoicedTotal = (views: InvoiceView[]) => views.filter(isInvoiced).reduce((s, v) => s + v.totals.total, 0);

export interface Unbilled { amount: number; minutes: number; items: number }

/** Work that is done but not yet on an invoice. */
export function unbilledOf(p: Project, time: TimeEntry[], today: string): Unbilled {
  let amount = 0;
  let minutes = 0;
  let items = 0;
  if (p.billingType === "hourly" && p.hourlyRate !== undefined) {
    for (const t of time) {
      if (t.projectId === p.id && t.billable && !t.invoiceId) minutes += t.minutes;
    }
    amount += Math.round((minutes * p.hourlyRate) / 60);
  }
  for (const m of p.milestones) {
    if (m.status === "approved" && !m.invoiceId) { amount += m.amount; items += 1; }
  }
  if (p.billingType === "retainer") {
    for (const r of p.retainerPeriods) {
      if (!r.invoiceId && r.start <= today) { amount += r.amount; items += 1; }
    }
  }
  return { amount, minutes, items };
}

function readyToInvoice(p: Project, views: InvoiceView[], time: TimeEntry[], today: string): string | null {
  const u = unbilledOf(p, time, today);
  const ms = p.milestones.find((m) => m.status === "approved" && !m.invoiceId);
  if (ms) return `“${ms.title}” is approved and ready to invoice.`;
  const period = p.billingType === "retainer" ? p.retainerPeriods.find((r) => !r.invoiceId && r.start <= today) : undefined;
  if (period) return `${period.label} is ready to invoice.`;
  if (p.billingType === "hourly" && u.minutes > 0) return `${formatHours(u.minutes)} tracked and ready to invoice.`;
  if (p.billingType === "fixed" && (p.progress ?? 0) >= 100 && (p.fixedAmount ?? 0) > invoicedTotal(views)) return "Work is complete and the balance is ready to invoice.";
  return null;
}

export interface StageInfo { stage: Stage; caption: string }

/**
 * Where the project sits on the Work → Approval → Invoice → Instructions → Paid thread.
 * Precedence: milestone awaiting approval, then something to invoice (or a draft),
 * then an open invoice, then fully paid; otherwise still in work.
 */
export function deriveStage(p: Project, views: InvoiceView[], time: TimeEntry[], today: string): StageInfo {
  const awaiting = p.milestones.find((m) => m.status === "awaiting_approval");
  if (awaiting) return { stage: "approval", caption: `“${awaiting.title}” is waiting for the client’s approval.` };

  const ready = readyToInvoice(p, views, time, today);
  if (ready) return { stage: "invoice", caption: ready };
  const draft = views.find((v) => v.display === "draft");
  if (draft) return { stage: "invoice", caption: `${draft.number} is a draft. Send it when you’re ready.` };

  const open = views.filter((v) => isLive(v.display));
  const first = open[0];
  if (first) {
    const balance = open.filter((v) => v.currency === first.currency).reduce((s, v) => s + v.totals.balance, 0);
    return { stage: "instructions", caption: `${first.number} is sent. ${formatMoney(balance, first.currency)} is still to be paid. Due ${fmtDate(first.dueDate)}.` };
  }

  const anyPaid = views.some((v) => v.display === "paid");
  const allApproved = p.milestones.length > 0 && p.milestones.every((m) => m.status === "approved");
  if (anyPaid && (p.status === "completed" || (p.progress ?? 0) >= 100 || allApproved)) return { stage: "paid", caption: "Everything is invoiced and paid." };

  return { stage: "work", caption: "Work is in progress. Nothing to invoice yet." };
}

export function stagePips(stage: Stage): ("done" | "current" | "todo")[] {
  const idx = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER.map((_, i) => (i < idx ? "done" : i === idx ? "current" : "todo"));
}

export interface ProgressInfo { pct: number; basis: string }

export function projectProgress(p: Project, today: string): ProgressInfo | null {
  if (p.milestones.length > 0) {
    const done = p.milestones.filter((m) => m.status === "approved").length;
    return { pct: Math.round((done / p.milestones.length) * 100), basis: `${done} of ${p.milestones.length} milestones approved` };
  }
  if (p.billingType === "retainer") {
    const cur = p.retainerPeriods.find((r) => r.start <= today && today <= r.end);
    if (!cur) return null;
    const total = daysBetween(cur.end, cur.start) + 1;
    const elapsed = daysBetween(today, cur.start) + 1;
    return { pct: Math.round((elapsed / total) * 100), basis: `of ${cur.label}` };
  }
  if (p.progress !== undefined) return { pct: Math.min(100, Math.max(0, p.progress)), basis: "set manually" };
  return null;
}

export interface SummaryItem { label: string; money?: { amount: number; currency: Currency }; text?: string; sub?: string }

export function projectSummary(p: Project, views: InvoiceView[], time: TimeEntry[], today: string): SummaryItem[] {
  const cur = p.currency;
  const invoiced = invoicedTotal(views);
  switch (p.billingType) {
    case "fixed": {
      const price = p.fixedAmount ?? 0;
      return [
        { label: "Price", money: { amount: price, currency: cur } },
        { label: "Invoiced", money: { amount: invoiced, currency: cur } },
        { label: "Remaining", money: { amount: Math.max(price - invoiced, 0), currency: cur } },
      ];
    }
    case "hourly": {
      const tracked = time.filter((t) => t.projectId === p.id).reduce((s, t) => s + t.minutes, 0);
      return [
        { label: "Rate", money: { amount: p.hourlyRate ?? 0, currency: cur }, sub: "per hour" },
        { label: "Tracked", text: formatDuration(tracked), sub: "all time" },
        { label: "Unbilled", money: { amount: unbilledOf(p, time, today).amount, currency: cur } },
      ];
    }
    case "retainer": {
      const current = p.retainerPeriods.find((r) => r.start <= today && today <= r.end);
      return [
        { label: "Per month", money: { amount: p.retainerAmount ?? 0, currency: cur }, sub: p.retainerHours ? `${p.retainerHours} h included` : undefined },
        { label: "Invoiced to date", money: { amount: invoiced, currency: cur } },
        { label: "Current period", text: current?.label ?? "None", sub: current ? `ends ${fmtDate(current.end)}` : undefined },
      ];
    }
    case "milestone": {
      const approved = p.milestones.filter((m) => m.status === "approved").length;
      return [
        { label: "Budget", money: { amount: milestoneTotal(p), currency: cur } },
        { label: "Invoiced", money: { amount: invoiced, currency: cur } },
        { label: "Approved", text: `${approved} of ${p.milestones.length}`, sub: "milestones" },
      ];
    }
  }
}

export interface WeekGroup { key: string; label: string; entries: number; minutes: number; amount: number; titles: string }

/** Unbilled billable time grouped by week (Monday start), newest first. */
export function unbilledWeeks(p: Project, time: TimeEntry[]): WeekGroup[] {
  const rate = p.hourlyRate ?? 0;
  const groups = new Map<string, TimeEntry[]>();
  for (const t of time) {
    if (t.projectId !== p.id || !t.billable || t.invoiceId) continue;
    const key = isoDate(startOfWeek(parse(t.date), { weekStartsOn: 1 }));
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, list]) => {
      const minutes = list.reduce((s, t) => s + t.minutes, 0);
      const titles = [...new Set(list.map((t) => t.description))].slice(0, 2).join(", ");
      return { key, label: `Week of ${format(parse(key), "d MMM")}`, entries: list.length, minutes, amount: Math.round((minutes * rate) / 60), titles };
    });
}

/** Monthly retainer periods from the start month through the current month (max 24). */
export function buildRetainerPeriods(startISO: string, amount: number, today: string): RetainerPeriod[] {
  const first = startOfMonth(parse(startISO));
  const last = startOfMonth(parse(today));
  const out: RetainerPeriod[] = [];
  let cursor = first;
  for (let i = 0; i < 24 && (cursor <= last || i === 0); i += 1) {
    out.push({ id: `rp-${format(cursor, "yyyyMM")}`, label: format(cursor, "MMM yyyy"), start: isoDate(cursor), end: isoDate(endOfMonth(cursor)), amount });
    cursor = addMonths(cursor, 1);
  }
  return out;
}

/** Plain-language state for a milestone row. */
export function milestoneState(status: Project["milestones"][number]["status"]): { label: string; tone: "done" | "wait" | "todo" | "warn" } {
  switch (status) {
    case "approved": return { label: "Approved", tone: "done" };
    case "awaiting_approval": return { label: "Awaiting approval", tone: "wait" };
    case "changes_requested": return { label: "Changes requested", tone: "warn" };
    case "upcoming": return { label: "Not started", tone: "todo" };
  }
}

export const STAGE_LABEL: Record<Stage, string> = { work: "Work", approval: "Approval", invoice: "Invoice", instructions: "Instructions", paid: "Paid" };
