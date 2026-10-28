import type { InvoiceCreateInput, TaxInputRow } from "@/lib/api/mappers/invoices";
import { addDays, fmtDate, isoDate, parse, todayISO } from "@/lib/dates";
import { lineAmount, previewTotals } from "@/lib/invoice";
import type { DocInvoice } from "@/lib/invoice-doc";
import { formatHours, formatMoney, parseAmount } from "@/lib/money";
import { uid } from "@/lib/store";
import type { InvoiceDetail, InvoiceLine, PaymentMethod, Project, ProjectWithSchedule, TimeEntry } from "@/lib/types";

/** Pure logic for the 5-step invoice builder: items per billing type, manual lines, validation, the API payload and a live preview. */

export const STEPS = ["Project", "Items", "Tax & discount", "Payment methods", "Review"] as const;
export const FIXED_BALANCE_ID = "fixed-balance";
export const NOTES_MAX = 5000;
export const INSTRUCTIONS_MAX = 2000;

export interface ReadyItem {
  id: string;
  kind: "time" | "retainer" | "milestone" | "fixed";
  title: string;
  sub: string;
  /** Minor units. */
  amount: number;
  /** Not selectable (e.g. milestone not approved yet). */
  disabled?: boolean;
  /** Preview model only; the API payload is derived from `kind` and `id` (see `buildPayload`). */
  line: Omit<InvoiceLine, "id">;
}

const hoursOf = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

const live = (invoices: InvoiceDetail[], projectId: string) => invoices.filter((i) => i.projectId === projectId && i.status !== "void");

/** Amount already invoiced against a fixed-price project (after discount, before tax; void excluded). */
export function invoicedAmount(project: Project, invoices: InvoiceDetail[]): number {
  return live(invoices, project.id).reduce((s, i) => s + i.subtotal - i.discountAmount, 0);
}

export const fixedRemaining = (project: Project, invoices: InvoiceDetail[]): number =>
  Math.max((project.budget ?? 0) - invoicedAmount(project, invoices), 0);

const MILESTONE_NOTE: Record<string, string> = {
  submitted: "Waiting on client approval · can’t be invoiced yet",
  pending: "Not started · can’t be invoiced yet",
  in_progress: "In progress · can’t be invoiced yet",
  rejected: "Client asked for changes · can’t be invoiced yet",
};

/** Milestone ids that a live invoice line already bills. */
const invoicedMilestones = (invoices: InvoiceDetail[], projectId: string): Set<string> =>
  new Set(live(invoices, projectId).flatMap((i) => i.items.map((l) => l.milestoneId).filter((x): x is string => !!x)));

/**
 * Everything that could go on an invoice for this project, by billing type. A milestone counts as invoiced when a
 * live invoice line carries its id (the milestone API has no `invoiceId`); a retainer period when it has an `invoiceId`
 * or a live invoice bills its start date. The server bills a retainer period in advance, so a future one is not selectable.
 */
export function itemsForProject(project: ProjectWithSchedule, time: TimeEntry[], invoices: InvoiceDetail[], today: string = todayISO()): ReadyItem[] {
  switch (project.billingType) {
    case "hourly": {
      const rate = project.hourlyRate ?? 0;
      return time
        .filter((t) => t.projectId === project.id && t.billable && !t.isInvoiced && !t.unsynced && t.endAt)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
        .map((t) => {
          const qty = hoursOf(t.minutes);
          const entryRate = t.hourlyRate ?? rate;
          return {
            id: t.id, kind: "time" as const,
            title: `${fmtDate(t.date)} · ${formatHours(t.minutes)}`, sub: `${t.description} · billable`,
            amount: Math.round(qty * entryRate),
            line: { description: `${fmtDate(t.date)} · ${t.description}`, qty, rate: entryRate, source: { type: "time" as const, refId: t.id } },
          };
        });
    }
    case "retainer": {
      const billedStarts = new Set(live(invoices, project.id).map((i) => i.retainerPeriodStart).filter((x): x is string => !!x));
      return project.retainerPeriods.filter((r) => !r.invoiceId && !billedStarts.has(r.start)).map((r) => {
        const future = r.start > today;
        return {
          id: r.id, kind: "retainer" as const,
          title: `Retainer · ${r.label}`,
          sub: future ? `${fmtDate(r.start)} – ${fmtDate(r.end)} · billed in advance, from ${fmtDate(r.start)}` : `${fmtDate(r.start)} – ${fmtDate(r.end)}`,
          amount: r.amount, disabled: future,
          line: { description: `Retainer · ${r.label}`, qty: 1, rate: r.amount, source: { type: "retainer" as const, refId: r.id } },
        };
      });
    }
    case "milestone": {
      const refs = invoicedMilestones(invoices, project.id);
      return project.milestones.filter((m) => !refs.has(m.id)).map((m) => {
        const amount = m.amount ?? 0;
        const noAmount = m.status === "approved" && amount <= 0;
        return {
          id: m.id, kind: "milestone" as const,
          title: m.title,
          sub: noAmount ? "Approved · no amount set, so there is nothing to invoice" : m.status === "approved" ? `Approved${m.approvedAt ? ` ${fmtDate(m.approvedAt.slice(0, 10))}` : ""}` : (MILESTONE_NOTE[m.status] ?? "Not ready"),
          amount, disabled: m.status !== "approved" || noAmount,
          line: { description: `${m.title} milestone`, qty: 1, rate: amount, source: { type: "milestone" as const, refId: m.id } },
        };
      });
    }
    case "fixed": {
      const remaining = fixedRemaining(project, invoices);
      if (remaining <= 0) return [];
      const already = invoicedAmount(project, invoices);
      return [{
        id: FIXED_BALANCE_ID, kind: "fixed" as const,
        title: already > 0 ? "Remaining balance" : "Full price",
        sub: `Fixed price ${formatMoney(project.budget ?? 0, project.currency)}${already > 0 ? ` · ${formatMoney(already, project.currency)} already invoiced` : ""}`,
        amount: remaining,
        line: { description: `${project.name} · ${already > 0 ? "remaining balance" : "fixed price"}`, qty: 1, rate: remaining, source: { type: "manual" as const } },
      }];
    }
  }
}

export const readyIds = (items: ReadyItem[]) => items.filter((i) => !i.disabled).map((i) => i.id);

/** One-line description of a project's billable state, for the project step. */
export function projectNote(project: Project, items: ReadyItem[]): string {
  const ready = items.filter((i) => !i.disabled);
  switch (project.billingType) {
    case "hourly": {
      const mins = ready.reduce((s, i) => s + Math.round(i.line.qty * 60), 0);
      return ready.length ? `${formatHours(mins)} uninvoiced` : "no uninvoiced time";
    }
    case "retainer": return ready.length ? `${ready[0]?.title.replace("Retainer · ", "")} period ready` : "no unbilled period";
    case "milestone": return ready.length ? `${ready.length} approved to invoice` : "nothing approved yet";
    case "fixed": return ready.length ? `${formatMoney(ready[0]?.amount ?? 0, project.currency)} left to invoice` : "fully invoiced";
  }
}

/**
 * Which selection to start with: everything ready, or only the item named by ?period=. A retainer invoice bills
 * one period, so only the earliest ready one is preselected.
 */
export function initialSelection(items: ReadyItem[], period?: string, project?: ProjectWithSchedule): string[] {
  if (period) {
    const byId = items.find((i) => !i.disabled && i.id === period);
    const byLabel = project?.retainerPeriods.find((r) => r.id === period || r.label.toLowerCase() === period.toLowerCase());
    const hit = byId?.id ?? (byLabel && items.find((i) => !i.disabled && i.id === byLabel.id)?.id);
    if (hit) return [hit];
  }
  const ready = readyIds(items);
  return items[0]?.kind === "retainer" ? ready.slice(0, 1) : ready;
}

/* ---------------------------------------------------------------- manual lines */

export interface ManualRow { id: string; description: string; qty: string; rate: string }
export const newManualRow = (): ManualRow => ({ id: uid("ml"), description: "", qty: "1", rate: "" });

const isBlank = (r: ManualRow) => r.description.trim() === "" && r.rate.trim() === "";

export function parseQty(s: string): number | null {
  const n = Number(s.replace(/,/g, "").trim());
  return s.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

export function manualRowError(r: ManualRow): string | null {
  if (isBlank(r)) return null;
  if (!r.description.trim()) return "Add a description";
  if (parseQty(r.qty) === null) return "Quantity must be more than 0";
  const rate = parseAmount(r.rate);
  if (rate === null || rate <= 0) return "Rate must be more than 0";
  return null;
}

export function manualLines(rows: ManualRow[]): InvoiceLine[] {
  const out: InvoiceLine[] = [];
  for (const r of rows) {
    if (isBlank(r) || manualRowError(r)) continue;
    out.push({ id: r.id, description: r.description.trim(), qty: parseQty(r.qty) ?? 1, rate: parseAmount(r.rate) ?? 0, source: { type: "manual" } });
  }
  return out;
}

/* ------------------------------------------------------------------ flow state */

/** `default` = the server applies the profile's default taxes; `none` = a deliberate "no tax"; `custom` = one named tax. */
export type TaxMode = "default" | "none" | "custom";

export interface FlowState {
  projectId: string;
  selected: string[];
  manual: ManualRow[];
  taxMode: TaxMode;
  taxName: string;
  /** Percent as typed. */
  taxRate: string;
  /** Percent as typed. */
  discount: string;
  termsDays: number;
  /** `null` = untouched: the server snapshots your default methods. `[]` = none. */
  methodIds: string[] | null;
  notes: string;
  paymentInstructions: string;
}

export function parsePercent(s: string): number | null {
  const t = s.trim();
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

export const selectedItems = (items: ReadyItem[], selected: string[]): ReadyItem[] => items.filter((i) => !i.disabled && selected.includes(i.id));

export function selectedLines(items: ReadyItem[], selected: string[]): InvoiceLine[] {
  return selectedItems(items, selected).map((i) => ({ ...i.line, id: uid("l") }));
}

export function allLines(items: ReadyItem[], state: Pick<FlowState, "selected" | "manual">): InvoiceLine[] {
  return [...selectedLines(items, state.selected), ...manualLines(state.manual)];
}

/** Terms offered in the select, always including the client's own terms. */
export function termsOptions(clientTerms: number): number[] {
  return [...new Set([0, 7, 14, 30, 45, 60, clientTerms])].sort((a, b) => a - b);
}
export const termsLabel = (d: number) => (d === 0 ? "Due on receipt" : `Net ${d}`);
export const dueDateFor = (issue: string, termsDays: number) => isoDate(addDays(parse(issue), termsDays));

/** The enabled default methods: what the server snapshots when `paymentMethodIds` is omitted. */
export function defaultMethodIds(methods: PaymentMethod[]): string[] {
  return methods.filter((m) => m.enabled && m.isDefault).map((m) => m.id);
}

export interface StepContext { state: FlowState; project?: Project; items: ReadyItem[] }

/** Returns an error message when the step can't be left, else null. */
export function validateStep(step: number, { state, project, items }: StepContext): string | null {
  switch (step) {
    case 1: return project ? null : "Choose a project to continue.";
    case 2: {
      if (state.manual.some((r) => manualRowError(r))) return "Finish or clear the incomplete extra line to continue.";
      if (selectedItems(items, state.selected).filter((i) => i.kind === "retainer").length > 1) return "An invoice bills one retainer period. Choose one to continue.";
      return allLines(items, state).length === 0 ? "Select at least one item or add a line to continue." : null;
    }
    case 3: {
      if (state.taxMode === "custom") {
        if (!state.taxName.trim()) return "Tax needs a name, like VAT.";
        if (parsePercent(state.taxRate) === null) return "Tax must be a number between 0 and 100.";
      }
      if (parsePercent(state.discount) === null) return "Discount must be a percentage between 0 and 100.";
      if (state.notes.length > NOTES_MAX) return `Notes can’t be longer than ${NOTES_MAX} characters.`;
      if (state.paymentInstructions.length > INSTRUCTIONS_MAX) return `Payment note can’t be longer than ${INSTRUCTIONS_MAX} characters.`;
      return null;
    }
    default: return null;
  }
}

/** The taxes the flow sends: `null` (omit) for the profile defaults, `[]` for none, else the one custom tax. */
export function taxRows(state: Pick<FlowState, "taxMode" | "taxName" | "taxRate">): TaxInputRow[] | null {
  if (state.taxMode === "default") return null;
  if (state.taxMode === "none") return [];
  return [{ name: state.taxName, rate: state.taxRate }];
}

/**
 * The `POST /invoices` input. Sources map to the API's own fields: time entries -> `timeEntryIds` (billed at each
 * entry's rate snapshot), approved milestones -> `milestoneIds`, a retainer period -> `retainerPeriodStart` (the
 * server adds the line), and the fixed-price balance plus manual rows -> `items`.
 */
export function buildPayload(state: FlowState, project: Project, items: ReadyItem[], issueDate: string): InvoiceCreateInput {
  const chosen = selectedItems(items, state.selected);
  const fixed = chosen.filter((i) => i.kind === "fixed").map((i) => ({ description: i.line.description, quantity: i.line.qty, unitPrice: i.line.rate }));
  const manual = manualLines(state.manual).map((l) => ({ description: l.description, quantity: l.qty, unitPrice: l.rate }));
  return {
    projectId: project.id,
    currency: project.currency,
    issueDate,
    dueDate: dueDateFor(issueDate, state.termsDays),
    items: [...fixed, ...manual],
    timeEntryIds: chosen.filter((i) => i.kind === "time").map((i) => i.id),
    milestoneIds: chosen.filter((i) => i.kind === "milestone").map((i) => i.id),
    retainerPeriodStart: chosen.find((i) => i.kind === "retainer")?.id,
    taxes: taxRows(state),
    discountRate: state.discount,
    notes: state.notes,
    paymentInstructions: state.paymentInstructions,
    paymentMethodIds: state.methodIds,
  };
}

/** A live preview of the invoice (never sent): the document model with totals from `previewTotals`. */
export function buildPreview(state: FlowState, project: Project | undefined, items: ReadyItem[], issueDate: string, currency: Project["currency"]): DocInvoice {
  const lines = allLines(items, state);
  const subtotal = lines.reduce((s, l) => s + lineAmount(l), 0);
  const rows = state.taxMode === "custom" ? [{ name: state.taxName.trim() || "Tax", rate: state.taxRate }] : [];
  const t = previewTotals(subtotal, state.discount, rows);
  return {
    number: "New invoice",
    currency: project?.currency ?? currency,
    issueDate,
    dueDate: dueDateFor(issueDate, state.termsDays),
    status: "draft",
    lines: lines.map((l) => ({ id: l.id, description: l.description, qty: l.qty, unitPrice: l.rate, amount: lineAmount(l), isTime: l.source?.type === "time" })),
    subtotal: t.subtotal,
    discount: t.discountAmount,
    taxes: rows.map((r, i) => ({ label: `${r.name} (${r.rate || 0}%)`, amount: t.taxLines[i] ?? 0 })),
    withholding: 0,
    total: t.total,
    paid: 0,
    balance: t.total,
    note: state.notes.trim() || undefined,
    paymentInstructions: state.paymentInstructions.trim() || undefined,
  };
}
