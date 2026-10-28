import { z } from "zod";
import type { ChangeRequestInput } from "@/lib/api/mappers/change-requests";
import { formatAmount, parseAmount } from "@/lib/money";
import type { ChangeRequest, Currency } from "@/lib/types";

/** Scope-change form: values are strings (inputs); the amount is parsed into minor units on save. */

const HOURS = /^\d{1,6}(\.\d{1,2})?$/;

export const changeRequestSchema = z.object({
  title: z.string().trim().min(1, "Name this scope change").max(255, "That title is too long"),
  description: z.string().max(10_000, "That description is too long"),
  estimatedHours: z.string().refine((s) => s.trim() === "" || HOURS.test(s.trim()), "Enter hours as a number with up to 2 decimals, or leave it blank"),
  estimatedAmount: z.string().refine((s) => s.trim() === "" || (parseAmount(s) ?? 0) > 0, "Enter an amount above 0, or leave it blank"),
});

export type ChangeRequestFormValues = z.infer<typeof changeRequestSchema>;

export const emptyChangeRequestForm = (): ChangeRequestFormValues => ({ title: "", description: "", estimatedHours: "", estimatedAmount: "" });

export function changeRequestToForm(c: ChangeRequest, currency: Currency): ChangeRequestFormValues {
  return {
    title: c.title,
    description: c.description,
    estimatedHours: c.estimatedHours === undefined ? "" : String(c.estimatedHours),
    estimatedAmount: c.estimatedAmount === undefined ? "" : formatAmount(c.estimatedAmount, currency).replace(/,/g, ""),
  };
}

export function formToChangeRequestInput(v: ChangeRequestFormValues): ChangeRequestInput {
  return {
    title: v.title.trim(),
    description: v.description.trim(),
    estimatedHours: v.estimatedHours.trim() === "" ? undefined : Number(v.estimatedHours.trim()),
    estimatedAmount: v.estimatedAmount.trim() === "" ? undefined : (parseAmount(v.estimatedAmount) ?? undefined),
  };
}

/** API field names that differ from the form's (none today; kept so a rename is a one-line change). */
export const CHANGE_REQUEST_FIELD_ALIASES: Record<string, string> = {};
