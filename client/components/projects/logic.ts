import { format, startOfWeek } from "date-fns";
import { fmtDate, isoDate, parse } from "@/lib/dates";
import { isLive } from "@/lib/invoice";
import { formatHours, formatMoney } from "@/lib/money";
import type { InvoiceView } from "@/lib/selectors";
import type { Stage } from "@/components/domain/stage-thread";
import type { BillingType, Milestone, MilestoneStatus, Project, ProjectStatus, ProjectWithSchedule, RetainerInterval, TimeEntry } from "@/lib/types";

/** Pure project helpers: labels, stage derivation, progress, unbilled work. */

export const BILLING_LABEL: Record<BillingType, string> = {
  fixed: "Fixed price",
  hourly: "Hourly",
  retainer: "Retainer",
  milestone: "Milestones",
};

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Draft", active: "Active", paused: "Paused", completed: "Completed", archived: "Archived", cancelled: "Cancelled",
};

export const INTERVAL_LABEL: Record<RetainerInterval, string> = { monthly: "month", quarterly: "quarter" };

const STAGE_ORDER: Stage[] = ["work", "approval", "invoice", "instructions", "paid"];

/** A project that has no milestones or periods loaded (list screens, screens not yet migrated). */
export const withoutSchedule = (p: Project): ProjectWithSchedule => ({ ...p, milestones: [], retainerPeriods: [] });

export const milestoneTotal = (milestones: Milestone[]) => milestones.reduce((s, m) => s + (m.amount ?? 0), 0);

/** "USD 45.00 / h", "USD 1,300.00 / month", "PKR 370,000". */
export function rateLabel(p: Project): string {
  switch (p.billingType) {
    case "hourly": return p.hourlyRate !== undefined ? `${formatMoney(p.hourlyRate, p.currency)} / h` : "Profile rate";
    case "retainer": {
      const per = p.retainerInterval ? INTERVAL_LABEL[p.retainerInterval] : "period";
      return p.retainerAmount !== undefined ? `${formatMoney(p.retainerAmount, p.currency)} / ${per}` : "Amount not set";
    }
    case "fixed": return p.budget !== undefined ? formatMoney(p.budget, p.currency) : "Price not set";
    case "milestone": return p.budget !== undefined ? formatMoney(p.budget, p.currency) : "Per milestone";
  }
}

/** Invoices that count as "invoiced" (everything sent or settled; not drafts or voids). */
const isInvoiced = (v: InvoiceView) => v.display !== "draft" && v.display !== "void";
export const invoicedTotal = (views: InvoiceView[]) => views.filter(isInvoiced).reduce((s, v) => s + v.totals.total, 0);

export interface Unbilled { amount: number; minutes: number; items: number }

/**
 * Work that is done but not yet on an invoice. Approved milestones are not counted: the milestone API does not
 * say whether one has been invoiced yet.
 */
export function unbilledOf(p: ProjectWithSchedule, time: TimeEntry[], today: string): Unbilled {
  let amount = 0;
  let minutes = 0;
  let items = 0;
  if (p.billingType === "hourly" && p.hourlyRate !== undefined) {
    for (const t of time) {
      if (t.projectId === p.id && t.billable && !t.invoiceId) minutes += t.minutes;
    }
    amount += Math.round((minutes * p.hourlyRate) / 60);
  }
  if (p.billingType === "retainer") {
    for (const r of p.retainerPeriods) {
      if (!r.invoiceId && r.start <= today) { amount += r.amount; items += 1; }
    }
  }
  return { amount, minutes, items };
}

function readyToInvoice(p: ProjectWithSchedule, views: InvoiceView[], time: TimeEntry[], today: string): string | null {
  const u = unbilledOf(p, time, today);
  const period = p.billingType === "retainer" ? p.retainerPeriods.find((r) => !r.invoiceId && r.start <= today) : undefined;
  if (period) return `${period.label} is ready to invoice.`;
  if (p.billingType === "hourly" && u.minutes > 0) return `${formatHours(u.minutes)} tracked and ready to invoice.`;
  if (p.billingType === "fixed" && (p.progressPercent ?? 0) >= 100 && (p.budget ?? 0) > invoicedTotal(views)) return "Work is complete and the balance is ready to invoice.";
  return null;
}

export interface StageInfo { stage: Stage; caption: string }

/**
 * Where the project sits on the Work → Approval → Invoice → Instructions → Paid thread.
 * Precedence: milestone awaiting approval, then something to invoice (or a draft),
 * then an open invoice, then fully paid; otherwise still in work.
 */
export function deriveStage(p: ProjectWithSchedule, views: InvoiceView[], time: TimeEntry[], today: string): StageInfo {
  const awaiting = p.milestones.find((m) => m.status === "submitted");
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
  if (anyPaid && (p.status === "completed" || (p.progressPercent ?? 0) >= 100 || allApproved)) return { stage: "paid", caption: "Everything is invoiced and paid." };

  return { stage: "work", caption: "Work is in progress. Nothing to invoice yet." };
}

export function stagePips(stage: Stage): ("done" | "current" | "todo")[] {
  const idx = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER.map((_, i) => (i < idx ? "done" : i === idx ? "current" : "todo"));
}

export interface ProgressInfo { pct: number; basis: string }

/** The server computes the percentage (milestones, else hours vs budget). `null` means "no progress to show". */
export function projectProgress(p: Pick<Project, "progressPercent" | "milestonesEnabled">): ProgressInfo | null {
  if (p.progressPercent === null) return null;
  return { pct: Math.min(100, Math.max(0, p.progressPercent)), basis: p.milestonesEnabled ? "from milestones" : "from hours against the budget" };
}

/** "45%" or "—" when the server has no progress for the project. */
export const progressText = (p: Pick<Project, "progressPercent">) => (p.progressPercent === null ? "—" : `${p.progressPercent}%`);

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

export type MilestoneTone = "done" | "wait" | "todo" | "warn";

/** Plain-language state for a milestone row. */
export function milestoneState(status: MilestoneStatus): { label: string; tone: MilestoneTone } {
  switch (status) {
    case "approved": return { label: "Approved", tone: "done" };
    case "submitted": return { label: "Awaiting approval", tone: "wait" };
    case "rejected": return { label: "Changes requested", tone: "warn" };
    case "in_progress": return { label: "In progress", tone: "wait" };
    case "pending": return { label: "Not started", tone: "todo" };
  }
}

export interface MilestoneActions {
  /** POST /milestones/{id}/submit: ask the client to approve. */
  canSubmit: boolean;
  /** Status changes the server allows through PATCH. */
  moves: { to: MilestoneStatus; label: string }[];
}

/**
 * What can be done to a milestone, mirroring the server's transition matrix:
 * PENDING -> IN_PROGRESS; IN_PROGRESS -> PENDING / APPROVED (only when approval is not required);
 * SUBMITTED -> IN_PROGRESS (withdraw); REJECTED -> IN_PROGRESS (rework). Submit works from
 * PENDING, IN_PROGRESS and REJECTED. APPROVED is final.
 */
export function milestoneActions(m: Pick<Milestone, "status" | "approvalRequired">): MilestoneActions {
  switch (m.status) {
    case "pending": return { canSubmit: true, moves: [{ to: "in_progress", label: "Start work" }] };
    case "in_progress": return {
      canSubmit: true,
      moves: [{ to: "pending", label: "Move back to not started" }, ...(m.approvalRequired ? [] : [{ to: "approved" as const, label: "Mark approved" }])],
    };
    case "submitted": return { canSubmit: false, moves: [{ to: "in_progress", label: "Withdraw submission" }] };
    case "rejected": return { canSubmit: true, moves: [{ to: "in_progress", label: "Start rework" }] };
    case "approved": return { canSubmit: false, moves: [] };
  }
}

export const STAGE_LABEL: Record<Stage, string> = { work: "Work", approval: "Approval", invoice: "Invoice", instructions: "Instructions", paid: "Paid" };
