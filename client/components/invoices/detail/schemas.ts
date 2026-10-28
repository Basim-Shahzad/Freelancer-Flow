import { z } from "zod";
import { RECORDABLE_METHODS } from "@/lib/api/mappers/invoices";
import { parseAmount } from "@/lib/money";

/** Record-payment form. `balance` (minor units) caps the amount so a payment can't exceed what is owed. */
export const recordSchema = (balance: number) =>
  z.object({
    amount: z.string().refine((v) => {
      const m = parseAmount(v);
      return m !== null && m > 0;
    }, "Enter the amount you received").refine((v) => {
      const m = parseAmount(v);
      return m === null || m <= balance;
    }, "That’s more than the balance. Record up to the amount still owed."),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date you received it"),
    method: z.string().refine((m) => (RECORDABLE_METHODS as string[]).includes(m), "Choose how it was paid"),
    reference: z.string().trim().max(255, "Keep the reference under 255 characters"),
  });

export type RecordValues = z.infer<ReturnType<typeof recordSchema>>;

/** Write-off needs a reason (the server rejects a blank one). */
export const writeOffSchema = z.object({ reason: z.string().trim().min(1, "Say why you’re writing this off").max(500, "Keep the reason under 500 characters") });

export type WriteOffValues = z.infer<typeof writeOffSchema>;

const percent = (v: string) => {
  const t = v.trim();
  if (t === "") return true;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 100;
};

/**
 * Edit-draft form: only what `PATCH /invoices/{id}` accepts (dates, taxes, tax note, discount, notes, payment note and
 * payment methods). `taxMode` `keep` leaves the invoice's taxes as they are; `changeMethods` leaves the methods alone when false.
 */
export const editDraftSchema = z
  .object({
    issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the issue date"),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the due date"),
    discountRate: z.string().refine(percent, "Discount must be a percentage between 0 and 100"),
    taxMode: z.enum(["keep", "none", "custom"]),
    taxName: z.string().max(100, "Keep the tax name under 100 characters"),
    taxRate: z.string(),
    taxNote: z.string().max(500, "Keep the tax note under 500 characters"),
    notes: z.string().max(5000, "Keep the notes under 5000 characters"),
    paymentInstructions: z.string().max(2000, "Keep the payment note under 2000 characters"),
    changeMethods: z.boolean(),
    methodIds: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    if (v.dueDate && v.issueDate && v.dueDate < v.issueDate) ctx.addIssue({ code: "custom", path: ["dueDate"], message: "The due date can’t be before the issue date" });
    if (v.taxMode === "custom") {
      if (!v.taxName.trim()) ctx.addIssue({ code: "custom", path: ["taxName"], message: "Tax needs a name, like VAT" });
      if (!percent(v.taxRate)) ctx.addIssue({ code: "custom", path: ["taxRate"], message: "Tax must be a number between 0 and 100" });
    }
  });

export type EditDraftValues = z.infer<typeof editDraftSchema>;
