import { toNestErrors } from "@hookform/resolvers";
import type { FieldErrors, Resolver } from "react-hook-form";
import { z } from "zod";
import { todayISO } from "@/lib/dates";
import { formatAmount, parseAmount } from "@/lib/money";
import type { BillingType, Client, Currency, Milestone, Project } from "@/lib/types";
import { buildRetainerPeriods } from "./logic";

/**
 * Project form: values are strings (inputs); a discriminated union on billingType validates only the fields
 * that apply to the chosen type. Amounts are parsed with parseAmount into minor units on save.
 */

export interface MilestoneRow { mid: string; title: string; amount: string; dueDate: string }

export interface ProjectFormValues {
  name: string;
  clientId: string;
  currency: Currency;
  status: Project["status"];
  startDate: string;
  billingType: BillingType;
  fixedAmount: string;
  hourlyRate: string;
  retainerAmount: string;
  retainerHours: string;
  progress: string;
  notes: string;
  milestones: MilestoneRow[];
}

const positiveAmount = (message: string) =>
  z.string().refine((s) => { const n = parseAmount(s); return n !== null && n > 0; }, message);

const optionalPositive = (message: string) => z.string().refine((s) => s.trim() === "" || (/^\d+(\.\d+)?$/.test(s.trim()) && Number(s) > 0), message);

const milestoneRow = z.object({
  mid: z.string(),
  title: z.string().trim().min(1, "Name this milestone"),
  amount: positiveAmount("Enter an amount above 0"),
  dueDate: z.string().min(1, "Choose a due date"),
});

const base = z.object({
  name: z.string().trim().min(1, "Enter a project name"),
  clientId: z.string().min(1, "Choose a client"),
  currency: z.enum(["USD", "PKR", "EUR", "GBP", "AED"]),
  status: z.enum(["active", "paused", "completed"]),
  startDate: z.string().min(1, "Choose a start date"),
  progress: z.string().refine((s) => s.trim() === "" || (/^\d{1,3}$/.test(s.trim()) && Number(s) <= 100), "Enter a percent from 0 to 100"),
  notes: z.string(),
  milestones: z.array(milestoneRow),
});

export const projectSchema = z.discriminatedUnion("billingType", [
  base.extend({ billingType: z.literal("fixed"), fixedAmount: positiveAmount("Enter the project price") }),
  base.extend({ billingType: z.literal("hourly"), hourlyRate: positiveAmount("Enter your hourly rate") }),
  base.extend({ billingType: z.literal("retainer"), retainerAmount: positiveAmount("Enter the amount per month"), retainerHours: optionalPositive("Enter hours as a number, like 12") }),
  base.extend({ billingType: z.literal("milestone"), milestones: z.array(milestoneRow).min(1, "Add at least one milestone") }),
]);

/** react-hook-form resolver over the discriminated union (typed against the flat form values). */
export const projectResolver: Resolver<ProjectFormValues> = async (values, _context, options) => {
  const r = projectSchema.safeParse(values);
  if (r.success) return { values, errors: {} };
  const flat: Record<string, { type: string; message: string }> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join(".");
    if (!flat[key]) flat[key] = { type: issue.code, message: issue.message };
  }
  return { values: {}, errors: toNestErrors(flat, options) as FieldErrors<ProjectFormValues> };
};

let counter = 0;
export const newRowId = () => `m-${Date.now().toString(36)}${(counter += 1).toString(36)}`;
export const emptyRow = (): MilestoneRow => ({ mid: newRowId(), title: "", amount: "", dueDate: "" });

export function emptyProjectForm(clients: Client[], defaultCurrency: Currency, clientId?: string): ProjectFormValues {
  const client = clients.find((c) => c.id === clientId);
  return {
    name: "", clientId: client?.id ?? "", currency: client?.currency ?? defaultCurrency, status: "active", startDate: todayISO(), billingType: "fixed",
    fixedAmount: "", hourlyRate: "", retainerAmount: "", retainerHours: "", progress: "", notes: "", milestones: [],
  };
}

const money = (minor: number | undefined, cur: Currency) => (minor === undefined ? "" : formatAmount(minor, cur));

export function projectToForm(p: Project): ProjectFormValues {
  return {
    name: p.name, clientId: p.clientId, currency: p.currency, status: p.status, startDate: p.startDate, billingType: p.billingType,
    fixedAmount: money(p.fixedAmount, p.currency), hourlyRate: money(p.hourlyRate, p.currency), retainerAmount: money(p.retainerAmount, p.currency),
    retainerHours: p.retainerHours ? String(p.retainerHours) : "", progress: p.progress === undefined ? "" : String(p.progress), notes: p.notes,
    milestones: p.milestones.map((m) => ({ mid: m.id, title: m.title, amount: formatAmount(m.amount, p.currency).replace(/,/g, ""), dueDate: m.dueDate })),
  };
}

/** Sum of milestone amounts in minor units (blank / invalid rows count as 0). */
export const milestoneSum = (rows: MilestoneRow[]) => rows.reduce((s, r) => s + (parseAmount(r.amount) ?? 0), 0);

/** Target the milestones are compared against: price for fixed, none otherwise. */
export function milestoneTarget(v: Pick<ProjectFormValues, "billingType" | "fixedAmount">): number | null {
  return v.billingType === "fixed" ? parseAmount(v.fixedAmount) : null;
}

/** Convert validated form values into the domain shape (minor units), preserving existing milestone state. */
export function formToProject(v: ProjectFormValues, existing?: Project, today: string = todayISO()): Omit<Project, "id" | "shareToken"> {
  const prev = new Map((existing?.milestones ?? []).map((m) => [m.id, m]));
  const milestones: Milestone[] = v.milestones.map((r) => {
    const old = prev.get(r.mid);
    const patch = { title: r.title.trim(), amount: parseAmount(r.amount) ?? 0, dueDate: r.dueDate };
    return old ? { ...old, ...patch } : { id: r.mid, description: "", status: "upcoming", ...patch };
  });

  const retainerAmount = v.billingType === "retainer" ? parseAmount(v.retainerAmount) ?? 0 : undefined;
  let retainerPeriods = existing?.retainerPeriods ?? [];
  if (v.billingType === "retainer" && retainerAmount !== undefined) {
    retainerPeriods = retainerPeriods.length === 0
      ? buildRetainerPeriods(v.startDate, retainerAmount, today)
      : retainerPeriods.map((r) => (r.invoiceId ? r : { ...r, amount: retainerAmount }));
  }

  const progress = v.progress.trim() === "" ? undefined : Math.min(100, Number(v.progress));
  const hours = v.retainerHours.trim() === "" ? undefined : Number(v.retainerHours);
  return {
    clientId: v.clientId, name: v.name.trim(), billingType: v.billingType, currency: v.currency, status: v.status, startDate: v.startDate,
    fixedAmount: v.billingType === "fixed" ? parseAmount(v.fixedAmount) ?? 0 : undefined,
    hourlyRate: v.billingType === "hourly" ? parseAmount(v.hourlyRate) ?? 0 : undefined,
    retainerAmount, retainerHours: v.billingType === "retainer" ? hours : undefined,
    progress, milestones, retainerPeriods, notes: v.notes.trim(),
  };
}
