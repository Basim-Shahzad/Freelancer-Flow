import { z } from "zod";
import type { MilestoneInput } from "@/lib/api/mappers/milestones";
import { formatAmount, parseAmount } from "@/lib/money";
import type { Currency, Milestone } from "@/lib/types";

/** Milestone form: values are strings (inputs); the amount is parsed into minor units on save. */

export const milestoneSchema = z.object({
  title: z.string().trim().min(1, "Name this milestone").max(255, "That name is too long"),
  description: z.string().max(10_000, "That description is too long"),
  amount: z.string().refine((s) => s.trim() === "" || (parseAmount(s) ?? 0) > 0, "Enter an amount above 0, or leave it blank"),
  dueDate: z.string(),
  approvalRequired: z.boolean(),
});

export type MilestoneFormValues = z.infer<typeof milestoneSchema>;

export const emptyMilestoneForm = (): MilestoneFormValues => ({ title: "", description: "", amount: "", dueDate: "", approvalRequired: false });

export function milestoneToForm(m: Milestone, currency: Currency): MilestoneFormValues {
  return {
    title: m.title, description: m.description, amount: m.amount === undefined ? "" : formatAmount(m.amount, currency).replace(/,/g, ""),
    dueDate: m.dueDate ?? "", approvalRequired: m.approvalRequired,
  };
}

export function formToMilestone(v: MilestoneFormValues): MilestoneInput {
  return {
    title: v.title.trim(), description: v.description.trim(), amount: v.amount.trim() === "" ? undefined : (parseAmount(v.amount) ?? undefined),
    dueDate: v.dueDate || undefined, approvalRequired: v.approvalRequired,
  };
}

/** API field names that differ from the form's. */
export const MILESTONE_FIELD_ALIASES: Record<string, string> = { name: "title" };
