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
