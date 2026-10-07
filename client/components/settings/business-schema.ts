import { z } from "zod";
import { formatInvoiceNumber } from "@/lib/invoice";
import { formatAmount, parseAmount } from "@/lib/money";
import type { BusinessProfile } from "@/lib/types";

export const TERMS_OPTIONS: { days: number; label: string }[] = [
  { days: 0, label: "Due on receipt" },
  { days: 7, label: "Net 7" },
  { days: 14, label: "Net 14" },
  { days: 30, label: "Net 30" },
  { days: 45, label: "Net 45" },
  { days: 60, label: "Net 60" },
];

export const termsLabel = (days: number) => TERMS_OPTIONS.find((t) => t.days === days)?.label ?? `Net ${days}`;

/** Terms options, always including the currently saved value even when it is not a preset. */
export function termsOptions(current: number) {
  return TERMS_OPTIONS.some((t) => t.days === current) ? TERMS_OPTIONS : [...TERMS_OPTIONS, { days: current, label: termsLabel(current) }].sort((a, b) => a.days - b.days);
}

/**
 * The lowest "next number" that cannot collide with an issued invoice for this prefix.
 * Numbers are never reused, even after a void, so every existing invoice counts.
 */
export function minNextInvoiceNumber(invoiceNumbers: string[], prefix: string): number {
  let max = 0;
  for (const n of invoiceNumbers) {
    if (!n.startsWith(prefix)) continue;
    const rest = n.slice(prefix.length);
    if (/^\d+$/.test(rest)) max = Math.max(max, Number(rest));
  }
  return max + 1;
}

const optionalText = (max: number, msg: string) => z.string().trim().max(max, msg);

/** Form schema. `invoiceNumbers` = every invoice number already issued (incl. void). */
export const businessFormSchema = (invoiceNumbers: string[] = []) =>
  z
    .object({
      businessName: z.string().trim().min(1, "Enter your business name").max(80, "Keep it under 80 characters"),
      ownerName: z.string().trim().min(1, "Enter your name").max(80, "Keep it under 80 characters"),
      email: z.string().trim().min(1, "Enter a billing email").pipe(z.email("Enter a valid email address, like you@example.com")),
      phone: z
        .string()
        .trim()
        .min(1, "Enter a phone or WhatsApp number")
        .regex(/^\+?[0-9][0-9 ()-]{5,19}$/, "Use digits, spaces and an optional leading +"),
      taxId: optionalText(30, "Keep it under 30 characters"),
      address: z.string().trim().min(1, "Enter your business address").max(240, "Keep it under 240 characters"),
      defaultCurrency: z.enum(["USD", "PKR", "EUR", "GBP", "AED"]),
      defaultTermsDays: z.string().regex(/^\d{1,3}$/, "Choose payment terms"),
      invoicePrefix: z.string().trim().regex(/^[A-Za-z0-9._/-]{0,12}$/, "Up to 12 letters, digits, dots, dashes or slashes"),
      nextInvoiceNumber: z.string().trim().regex(/^\d{1,6}$/, "Enter a whole number, up to 6 digits"),
      footerNote: optionalText(200, "Keep it under 200 characters"),
      logoName: z.string().max(160).optional(),
      hourlyRate: z.string().trim().refine((s) => {
        if (s === "") return true;
        const n = parseAmount(s);
        return n !== null && n > 0 && n <= 100_000_000;
      }, "Enter an amount like 40 or 40.50, or leave blank"),
    })
    .superRefine((v, ctx) => {
      if (!/^\d{1,6}$/.test(v.nextInvoiceNumber)) return;
      const next = Number(v.nextInvoiceNumber);
      const min = minNextInvoiceNumber(invoiceNumbers, v.invoicePrefix.trim());
      if (next < 1) ctx.addIssue({ code: "custom", path: ["nextInvoiceNumber"], message: "Start from 1 or higher" });
      else if (next < min) ctx.addIssue({ code: "custom", path: ["nextInvoiceNumber"], message: `Use ${String(min).padStart(4, "0")} or higher. Numbers are never reused, even after a void.` });
    });

export type BusinessFormValues = z.infer<ReturnType<typeof businessFormSchema>>;

export function toFormValues(b: BusinessProfile): BusinessFormValues {
  return {
    businessName: b.businessName, ownerName: b.ownerName, email: b.email, phone: b.phone, taxId: b.taxId, address: b.address,
    defaultCurrency: b.defaultCurrency, defaultTermsDays: String(b.defaultTermsDays), invoicePrefix: b.invoicePrefix,
    nextInvoiceNumber: String(b.nextInvoiceNumber).padStart(4, "0"), footerNote: b.footerNote, logoName: b.logoName,
    hourlyRate: b.hourlyRate ? formatAmount(b.hourlyRate, b.defaultCurrency).replace(/,/g, "") : "",
  };
}

export function fromFormValues(v: BusinessFormValues): BusinessProfile {
  return {
    businessName: v.businessName.trim(), ownerName: v.ownerName.trim(), email: v.email.trim(), phone: v.phone.trim(), taxId: v.taxId.trim(),
    address: v.address.trim(), defaultCurrency: v.defaultCurrency, defaultTermsDays: Number(v.defaultTermsDays),
    invoicePrefix: v.invoicePrefix.trim(), nextInvoiceNumber: Number(v.nextInvoiceNumber), footerNote: v.footerNote.trim(), logoName: v.logoName || undefined,
    hourlyRate: v.hourlyRate.trim() === "" ? undefined : (parseAmount(v.hourlyRate) ?? undefined),
  };
}

/** "INV-0046" preview of the next number. */
export const nextNumberPreview = (prefix: string, next: string) => (/^\d{1,6}$/.test(next) ? formatInvoiceNumber(prefix.trim(), Number(next)) : "");
