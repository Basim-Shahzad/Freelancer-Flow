import { toNestErrors } from "@hookform/resolvers";
import type { FieldErrors, Resolver } from "react-hook-form";
import { z } from "zod";
import type { ProjectInput } from "@/lib/api/mappers/projects";
import { formatAmount, parseAmount } from "@/lib/money";
import type { BillingType, Client, Currency, Project, ProjectStatus, RetainerInterval } from "@/lib/types";

/**
 * Project form: values are strings (inputs); a discriminated union on billingType validates only the fields
 * that apply to the chosen type. Amounts are parsed with parseAmount into minor units on save. Milestones are
 * managed on the project page (they are separate records), not in this form.
 */

export const PROJECT_STATUSES: ProjectStatus[] = ["draft", "active", "paused", "completed", "archived", "cancelled"];

export interface ProjectFormValues {
  name: string;
  clientId: string;
  description: string;
  currency: Currency;
  status: ProjectStatus;
  billingType: BillingType;
  /** FIXED: the price. */
  budget: string;
  /** HOURLY: blank = use the rate from your profile. */
  hourlyRate: string;
  retainerAmount: string;
  retainerInterval: RetainerInterval | "";
  retainerStartDate: string;
  retainerEndDate: string;
  dueDate: string;
  milestonesEnabled: boolean;
}

const positiveAmount = (message: string) =>
  z.string().refine((s) => { const n = parseAmount(s); return n !== null && n > 0; }, message);

const optionalPositiveAmount = (message: string) =>
  z.string().refine((s) => s.trim() === "" || ((parseAmount(s) ?? 0) > 0), message);

const base = z.object({
  name: z.string().trim().min(1, "Enter a project name").max(255, "That name is too long"),
  clientId: z.string().min(1, "Choose a client"),
  description: z.string(),
  currency: z.enum(["USD", "PKR", "EUR", "GBP", "AED"]),
  status: z.enum(["draft", "active", "paused", "completed", "archived", "cancelled"]),
  dueDate: z.string(),
  milestonesEnabled: z.boolean(),
  budget: z.string(),
  hourlyRate: z.string(),
  retainerAmount: z.string(),
  retainerInterval: z.string(),
  retainerStartDate: z.string(),
  retainerEndDate: z.string(),
});

export const projectSchema = z.discriminatedUnion("billingType", [
  base.extend({ billingType: z.literal("fixed"), budget: positiveAmount("Enter the project price") }),
  base.extend({ billingType: z.literal("hourly"), hourlyRate: optionalPositiveAmount("Enter a rate above 0, or leave it blank to use your profile rate") }),
  base.extend({ billingType: z.literal("milestone") }),
  base
    .extend({
      billingType: z.literal("retainer"),
      retainerAmount: positiveAmount("Enter the amount per period"),
      retainerInterval: z.enum(["monthly", "quarterly"], { message: "Choose how often you bill" }),
    })
    .refine((v) => v.retainerEndDate === "" || v.retainerStartDate === "" || v.retainerEndDate > v.retainerStartDate, {
      message: "The end date must be after the start date",
      path: ["retainerEndDate"],
    }),
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

export function emptyProjectForm(clients: Client[], defaultCurrency: Currency, clientId?: string): ProjectFormValues {
  const client = clients.find((c) => c.id === clientId);
  return {
    name: "", clientId: client?.id ?? "", description: "", currency: client?.currency ?? defaultCurrency, status: "active", billingType: "fixed",
    budget: "", hourlyRate: "", retainerAmount: "", retainerInterval: "monthly", retainerStartDate: "", retainerEndDate: "", dueDate: "", milestonesEnabled: false,
  };
}

const money = (minor: number | undefined, cur: Currency) => (minor === undefined ? "" : formatAmount(minor, cur).replace(/,/g, ""));

export function projectToForm(p: Project): ProjectFormValues {
  return {
    name: p.name, clientId: p.clientId, description: p.description, currency: p.currency, status: p.status, billingType: p.billingType,
    budget: money(p.budget, p.currency), hourlyRate: money(p.hourlyRate, p.currency), retainerAmount: money(p.retainerAmount, p.currency),
    retainerInterval: p.retainerInterval ?? "monthly", retainerStartDate: p.retainerStartDate ?? "", retainerEndDate: p.retainerEndDate ?? "",
    dueDate: p.dueDate ?? "", milestonesEnabled: p.milestonesEnabled || p.billingType === "milestone",
  };
}

/** Convert validated form values into the API input shape (minor units); fields of other billing types are dropped. */
export function formToProject(v: ProjectFormValues): ProjectInput {
  const retainer = v.billingType === "retainer";
  return {
    name: v.name.trim(), clientId: v.clientId, description: v.description.trim(), billingType: v.billingType, currency: v.currency, status: v.status,
    budget: v.billingType === "fixed" ? parseAmount(v.budget) ?? undefined : undefined,
    hourlyRate: v.billingType === "hourly" ? parseAmount(v.hourlyRate) ?? undefined : undefined,
    retainerAmount: retainer ? parseAmount(v.retainerAmount) ?? undefined : undefined,
    retainerInterval: retainer && v.retainerInterval !== "" ? v.retainerInterval : undefined,
    retainerStartDate: retainer && v.retainerStartDate ? v.retainerStartDate : undefined,
    retainerEndDate: retainer && v.retainerEndDate ? v.retainerEndDate : undefined,
    dueDate: v.dueDate || undefined,
    milestonesEnabled: v.billingType === "milestone" ? true : v.milestonesEnabled,
  };
}

/** API field names that differ from the form's (none today: the API and the form share their names). */
export const PROJECT_FIELD_ALIASES: Record<string, string> = {};
