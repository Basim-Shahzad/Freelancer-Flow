import type { Stage } from "@/components/domain/stage-thread";
import { daysBetween, fmtDate, todayISO } from "@/lib/dates";
import { daysOverdue, deriveStatus, isLive, calcTotals } from "@/lib/invoice";
import { formatMoney } from "@/lib/money";
import type { Invoice, InvoiceStatus, Milestone, MilestoneStatus, PaymentMethod, PaymentMethodKind, Project } from "@/lib/types";

export const firstName = (full: string | undefined, fallback = "the freelancer") => full?.trim().split(/\s+/)[0] || fallback;

/** Draft and void invoices are not visible through a share link. */
export const isPortalVisible = (inv: Invoice) => inv.status !== "draft" && inv.status !== "void";

/** Invoices for a project that the client may see, newest first. */
export function projectInvoices(project: Project, invoices: Invoice[]): Invoice[] {
  return invoices
    .filter((i) => i.projectId === project.id && isPortalVisible(i))
    .sort((a, b) => (a.issueDate < b.issueDate ? 1 : a.issueDate > b.issueDate ? -1 : 0));
}

export interface MilestoneStats {
  total: number;
  approvedAmount: number;
  /** Rounded percent of project value that is approved (0-100). */
  percent: number;
  doneCount: number;
  count: number;
}

export function milestoneStats(milestones: Milestone[]): MilestoneStats {
  const total = milestones.reduce((s, m) => s + m.amount, 0);
  const approvedAmount = milestones.filter((m) => m.status === "approved").reduce((s, m) => s + m.amount, 0);
  return {
    total,
    approvedAmount,
    percent: total > 0 ? Math.round((approvedAmount / total) * 100) : 0,
    doneCount: milestones.filter((m) => m.status === "approved").length,
    count: milestones.length,
  };
}

/** Where the project sits on the Work → Approval → Invoice → Instructions → Paid thread. */
export function deriveProjectStage(project: Project, invoices: Invoice[], today: string = todayISO()): Stage {
  const visible = invoices.filter(isPortalVisible);
  const billable = visible.filter((i) => i.status !== "written_off");
  const allPaid = billable.length > 0 && billable.every((i) => deriveStatus(i, today) === "paid");

  if (project.billingType === "milestone" && project.milestones.length > 0) {
    const ms = project.milestones;
    if (ms.some((m) => m.status === "awaiting_approval")) return "approval";
    const allApproved = ms.every((m) => m.status === "approved");
    if (allApproved && allPaid) return "paid";
    if (ms.some((m) => m.status === "approved")) return "invoice";
    return "work";
  }
  if (project.status === "completed" && allPaid) return "paid";
  if (billable.some((i) => isLive(deriveStatus(i, today)))) return "invoice";
  return "work";
}

export function projectCaption(project: Project, stage: Stage, ownerFirst: string): string {
  if (project.billingType === "milestone") {
    const waiting = project.milestones.filter((m) => m.status === "awaiting_approval").length;
    if (stage === "approval") return waiting > 1 ? `${waiting} milestones are waiting for your approval` : "One milestone is waiting for your approval";
    if (stage === "paid") return "Everything approved and paid. Thank you";
    if (stage === "invoice") return "Approved · invoice on its way";
    if (project.milestones.some((m) => m.status === "changes_requested")) return `Waiting for ${ownerFirst} to make your changes`;
    return `${ownerFirst} is working on the first milestone`;
  }
  if (stage === "paid") return "Completed and paid. Thank you";
  if (stage === "invoice") return "An invoice is ready for you";
  return project.status === "completed" ? "Work completed" : `${ownerFirst} is working on this`;
}

export const MILESTONE_STATE_LABEL: Record<MilestoneStatus, string> = {
  upcoming: "Upcoming",
  awaiting_approval: "Needs you",
  approved: "Approved",
  changes_requested: "Changes requested",
};

export function milestoneSub(m: Milestone, ownerFirst: string): string {
  switch (m.status) {
    case "approved": return m.approvedAt ? `Approved ${fmtDate(m.approvedAt.slice(0, 10))}` : "Approved";
    case "awaiting_approval": return `Waiting for your approval · due ${fmtDate(m.dueDate)}`;
    case "changes_requested": return `Changes requested · waiting for ${ownerFirst} to update`;
    default: return `Due ${fmtDate(m.dueDate)}`;
  }
}

/** One line under the invoice number: "Due 20 Sep 2026 · 15 days overdue". */
export function dueLine(inv: Invoice, display: InvoiceStatus, today: string = todayISO()): string {
  if (display === "paid") return `Paid ${fmtDate(lastPaymentDate(inv) ?? inv.dueDate)}`;
  if (display === "written_off") return "Closed";
  if (display === "overdue") {
    const n = daysOverdue(inv, today);
    return `Due ${fmtDate(inv.dueDate)} · ${n} ${n === 1 ? "day" : "days"} overdue`;
  }
  return daysBetween(today, inv.dueDate) === 0 ? "Due today" : `Due ${fmtDate(inv.dueDate)}`;
}

export function lastPaymentDate(inv: Invoice): string | undefined {
  return inv.payments.map((p) => p.date).sort().at(-1);
}

export interface InvoiceHero {
  label: string;
  amount: number;
  /** Show a labelled estimate in the other reference currency. */
  estimate: boolean;
}

export function invoiceHero(inv: Invoice, display: InvoiceStatus): InvoiceHero {
  const t = calcTotals(inv);
  if (display === "paid") return { label: "Amount paid", amount: t.total, estimate: false };
  if (display === "written_off") return { label: "Invoice total", amount: t.total, estimate: false };
  if (display === "partial") return { label: "Balance due", amount: t.balance, estimate: true };
  return { label: "Amount due", amount: t.balance, estimate: true };
}

export function invoiceCaption(inv: Invoice, display: InvoiceStatus): string {
  const t = calcTotals(inv);
  if (display === "paid") return `Paid in full · ${fmtDate(lastPaymentDate(inv))}`;
  if (display === "partial") return `${formatMoney(t.paid, inv.currency)} received · ${formatMoney(t.balance, inv.currency)} to go`;
  if (display === "overdue") return "This invoice is past its due date";
  if (display === "written_off") return "This invoice is closed";
  return "Pay the freelancer directly, using the details below";
}

/** Methods shown to the client: the invoice's selection, in its order, still enabled and still existing. */
export function methodsForInvoice(inv: Invoice, all: PaymentMethod[]): PaymentMethod[] {
  return inv.paymentMethodIds.flatMap((id) => {
    const m = all.find((x) => x.id === id);
    return m && m.enabled ? [m] : [];
  });
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
