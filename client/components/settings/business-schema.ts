import { z } from "zod";
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

const optionalText = (max: number, msg: string) => z.string().trim().max(max, msg);

/** Form schema. */
export const businessFormSchema = () =>
  z
    .object({
      businessName: z.string().trim().min(1, "Enter your business name").max(80, "Keep it under 80 characters"),
      ownerName: z.string().trim().min(1, "Enter your name").max(80, "Keep it under 80 characters"),
      email: z.string().trim().min(1, "Enter a billing email").pipe(z.email("Enter a valid email address, like you@example.com")),
      taxId: optionalText(30, "Keep it under 30 characters"),
      address: z.string().trim().min(1, "Enter your business address").max(240, "Keep it under 240 characters"),
      defaultCurrency: z.enum(["USD", "PKR", "EUR", "GBP", "AED"]),
      defaultTermsDays: z.string().regex(/^\d{1,3}$/, "Choose payment terms"),
      invoiceNumberFormat: z.string().trim().min(1, "Enter an invoice number format").max(100, "Keep it under 100 characters").refine((v) => v.includes("{seq"), "Include {seq}, e.g. INV-{seq:04d}"),
      paymentInstructions: optionalText(2000, "Keep it under 2000 characters"),
      hourlyRate: z.string().trim().refine((s) => {
        if (s === "") return true;
        const n = parseAmount(s);
        return n !== null && n > 0 && n <= 100_000_000;
      }, "Enter an amount like 40 or 40.50, or leave blank"),
    });

export type BusinessFormValues = z.infer<ReturnType<typeof businessFormSchema>>;

export function toFormValues(b: BusinessProfile): BusinessFormValues {
  return {
    businessName: b.businessName, ownerName: b.ownerName, email: b.email, taxId: b.taxId, address: b.address,
    defaultCurrency: b.defaultCurrency, defaultTermsDays: String(b.defaultTermsDays), invoiceNumberFormat: b.invoiceNumberFormat,
    paymentInstructions: b.paymentInstructions,
    hourlyRate: b.hourlyRate ? formatAmount(b.hourlyRate, b.defaultCurrency).replace(/,/g, "") : "",
  };
}

/** Form values -> view model. `logoUrl` is read-only (no upload endpoint) so it is carried over from `base`. */
export function fromFormValues(v: BusinessFormValues, base?: Pick<BusinessProfile, "logoUrl">): BusinessProfile {
  return {
    businessName: v.businessName.trim(), ownerName: v.ownerName.trim(), email: v.email.trim(), taxId: v.taxId.trim(),
    address: v.address.trim(), defaultCurrency: v.defaultCurrency, defaultTermsDays: Number(v.defaultTermsDays),
    invoiceNumberFormat: v.invoiceNumberFormat.trim(), paymentInstructions: v.paymentInstructions.trim(), logoUrl: base?.logoUrl,
    hourlyRate: v.hourlyRate.trim() === "" ? undefined : (parseAmount(v.hourlyRate) ?? undefined),
  };
}

/** "INV-0001" example of what a number format renders ({seq:04d} pads, {year} is the current year). */
export function formatSampleNumber(format: string, seq = 1, year = new Date().getFullYear()): string {
  return format
    .replace(/\{seq(?::0?(\d{1,2})d)?\}/g, (_m, w?: string) => String(seq).padStart(w ? Number(w) : 0, "0"))
    .replace(/\{year\}/g, String(year));
}
