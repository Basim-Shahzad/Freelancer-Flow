import { addDays, fmtDate, isoDate, parse } from "@/lib/dates";
import { calcTotals, lineAmount } from "@/lib/invoice";
import { formatHours, formatMoney, parseAmount } from "@/lib/money";
import { uid, type NewInvoiceInput } from "@/lib/store";
import type { Client, Invoice, InvoiceLine, PaymentMethod, Project, TimeEntry } from "@/lib/types";

/** Pure logic for the 5-step invoice builder: items per billing type, manual lines, validation, totals. */

export const STEPS = ["Project", "Items", "Tax & discount", "Payment methods", "Review"] as const;
export const FIXED_BALANCE_ID = "fixed-balance";

export interface ReadyItem {
  id: string;
  kind: "time" | "retainer" | "milestone" | "fixed";
  title: string;
  sub: string;
  /** Minor units. */
  amount: number;
  /** Not selectable (e.g. milestone not approved yet). */
  disabled?: boolean;
  line: Omit<InvoiceLine, "id">;
}

const hoursOf = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

/** Amount already invoiced against a fixed-price project (after discount, before tax; void excluded). */
export function invoicedAmount(project: Project, invoices: Invoice[]): number {
  return invoices.filter((i) => i.projectId === project.id && i.status !== "void").reduce((s, i) => s + calcTotals(i).taxable, 0);
}

export const fixedRemaining = (project: Project, invoices: Invoice[]): number =>
  Math.max((project.fixedAmount ?? 0) - invoicedAmount(project, invoices), 0);

const MILESTONE_NOTE: Record<string, string> = {
  awaiting_approval: "Waiting on client approval · can’t be invoiced yet",
  upcoming: "Not started · can’t be invoiced yet",
  changes_requested: "Client asked for changes · can’t be invoiced yet",
};

/** Everything that could go on an invoice for this project, by billing type. */
export function itemsForProject(project: Project, time: TimeEntry[], invoices: Invoice[]): ReadyItem[] {
  switch (project.billingType) {
    case "hourly": {
      const rate = project.hourlyRate ?? 0;
      return time
        .filter((t) => t.projectId === project.id && t.billable && !t.invoiceId)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
        .map((t) => {
          const qty = hoursOf(t.minutes);
          return {
            id: t.id, kind: "time" as const,
            title: `${fmtDate(t.date)} · ${formatHours(t.minutes)}`, sub: `${t.description} · billable`,
            amount: Math.round(qty * rate),
            line: { description: `${fmtDate(t.date)} · ${t.description}`, qty, rate, source: { type: "time" as const, refId: t.id } },
          };
        });
    }
    case "retainer":
      return project.retainerPeriods.filter((r) => !r.invoiceId).map((r) => ({
        id: r.id, kind: "retainer" as const,
        title: `Retainer · ${r.label}`,
        sub: `${fmtDate(r.start)} – ${fmtDate(r.end)}${project.retainerHours ? ` · ${project.retainerHours} h included` : ""}`,
        amount: r.amount,
        line: { description: `Retainer · ${r.label}`, qty: 1, rate: r.amount, source: { type: "retainer" as const, refId: r.id } },
      }));
    case "milestone":
      return project.milestones.filter((m) => !m.invoiceId).map((m) => ({
        id: m.id, kind: "milestone" as const,
        title: m.title,
        sub: m.status === "approved" ? `Approved${m.approvedAt ? ` ${fmtDate(m.approvedAt)}` : ""}` : (MILESTONE_NOTE[m.status] ?? "Not ready"),
        amount: m.amount, disabled: m.status !== "approved",
        line: { description: `${m.title} milestone`, qty: 1, rate: m.amount, source: { type: "milestone" as const, refId: m.id } },
      }));
    case "fixed": {
      const remaining = fixedRemaining(project, invoices);
      if (remaining <= 0) return [];
      const already = invoicedAmount(project, invoices);
      return [{
        id: FIXED_BALANCE_ID, kind: "fixed" as const,
        title: already > 0 ? "Remaining balance" : "Full price",
        sub: `Fixed price ${formatMoney(project.fixedAmount ?? 0, project.currency)}${already > 0 ? ` · ${formatMoney(already, project.currency)} already invoiced` : ""}`,
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

/** Which selection to start with: everything ready, or only the item named by ?period=. */
export function initialSelection(items: ReadyItem[], period?: string, project?: Project): string[] {
  if (period) {
    const byId = items.find((i) => !i.disabled && i.id === period);
    const byLabel = project?.retainerPeriods.find((r) => r.id === period || r.label.toLowerCase() === period.toLowerCase());
    const hit = byId?.id ?? (byLabel && items.find((i) => !i.disabled && i.id === byLabel.id)?.id);
    if (hit) return [hit];
  }
  return readyIds(items);
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

export interface FlowState {
  projectId: string;
  selected: string[];
  manual: ManualRow[];
  tax: string;
  discount: string;
  termsDays: number;
  methodIds: string[];
}

export function parsePercent(s: string): number | null {
  const t = s.trim();
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

export function parseDiscount(s: string): number | null {
  if (s.trim() === "") return 0;
  const m = parseAmount(s);
  return m !== null && m >= 0 ? m : null;
}

export function selectedLines(items: ReadyItem[], selected: string[]): InvoiceLine[] {
  return items.filter((i) => !i.disabled && selected.includes(i.id)).map((i) => ({ ...i.line, id: uid("l") }));
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

/** Enabled methods in order; start with the ones the client usually pays by, else the default. */
export function defaultMethodIds(methods: PaymentMethod[], client?: Client): string[] {
  const enabled = methods.filter((m) => m.enabled);
  const preferred = enabled.filter((m) => client?.prefersMethods.includes(m.kind));
  if (preferred.length) return preferred.map((m) => m.id);
  const def = enabled.find((m) => m.isDefault) ?? enabled[0];
  return def ? [def.id] : [];
}

export interface StepContext { state: FlowState; project?: Project; items: ReadyItem[]; enabledMethodCount: number }

/** Returns an error message when the step can't be left, else null. */
export function validateStep(step: number, { state, project, items, enabledMethodCount }: StepContext): string | null {
  switch (step) {
    case 1: return project ? null : "Choose a project to continue.";
    case 2: {
      if (state.manual.some((r) => manualRowError(r))) return "Finish or clear the incomplete extra line to continue.";
      return allLines(items, state).length === 0 ? "Select at least one item or add a line to continue." : null;
    }
    case 3: {
      if (parsePercent(state.tax) === null) return "Tax must be a number between 0 and 100.";
      const discount = parseDiscount(state.discount);
      if (discount === null) return "Discount must be an amount like 50 or 12.50.";
      const subtotal = allLines(items, state).reduce((s, l) => s + lineAmount(l), 0);
      return discount > subtotal ? "Discount can’t be more than the subtotal." : null;
    }
    case 4: return state.methodIds.length === 0 && enabledMethodCount > 0 ? "Choose at least one way for your client to pay you." : null;
    default: return null;
  }
}

/** Store input for createInvoice. */
export function buildInput(state: FlowState, project: Project, client: Client, items: ReadyItem[], asDraft: boolean): NewInvoiceInput {
  const chosen = items.filter((i) => !i.disabled && state.selected.includes(i.id));
  return {
    clientId: client.id, projectId: project.id, currency: project.currency,
    dueDate: dueDateFor(isoDate(new Date()), state.termsDays),
    lines: allLines(items, state),
    taxPercent: parsePercent(state.tax) ?? 0, discount: parseDiscount(state.discount) ?? 0,
    paymentMethodIds: state.methodIds,
    timeEntryIds: chosen.filter((i) => i.kind === "time").map((i) => i.id),
    milestoneIds: chosen.filter((i) => i.kind === "milestone").map((i) => i.id),
    retainerPeriodIds: chosen.filter((i) => i.kind === "retainer").map((i) => i.id),
    asDraft,
  };
}

/** In-progress invoice for the live preview (never stored). */
export function buildTransientInvoice(input: NewInvoiceInput, number: string, issueDate: string): Invoice {
  return {
    id: "preview", number, clientId: input.clientId, projectId: input.projectId, currency: input.currency, status: "draft",
    issueDate, dueDate: input.dueDate, lines: input.lines, taxPercent: input.taxPercent, discount: input.discount,
    paymentMethodIds: input.paymentMethodIds, note: input.note ?? "", shareToken: "preview", payments: [], events: [],
  };
}
