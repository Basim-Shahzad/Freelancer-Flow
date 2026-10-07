import { z } from "zod";
import { METHOD_KINDS } from "@/lib/payment-methods";
import type { Client, Currency, PaymentMethodKind } from "@/lib/types";

/** Client form schema and conversions. Form values are all strings (select/inputs); conversion happens on save. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const waDigits = (input: string) => input.replace(/\D/g, "");

/** 8 to 15 digits (E.164 allows up to 15) and only phone-ish characters. Empty is allowed. */
export function isValidWhatsapp(input: string): boolean {
  const s = input.trim();
  if (s === "") return true;
  if (!/^[+\d\s().-]+$/.test(s)) return false;
  const n = waDigits(s).length;
  return n >= 8 && n <= 15;
}

/** "+92 321 5550188" (single spaces, one leading +). Empty stays empty. */
export function normalizeWhatsapp(input: string): string {
  const s = input.trim().replace(/^\++/, "").replace(/[^\d\s]/g, "").replace(/\s+/g, " ").trim();
  return s ? `+${s}` : "";
}

/** wa.me deep link, or null when there is no usable number. */
export function waLink(whatsapp: string): string | null {
  const d = waDigits(whatsapp);
  return d.length >= 8 ? `https://wa.me/${d}` : null;
}

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Enter the client or company name"),
  contactName: z.string().trim(),
  email: z.string().trim().min(1, "Enter an email address").refine((v) => EMAIL.test(v), "Enter a valid email address, like name@company.com"),
  whatsapp: z.string().refine(isValidWhatsapp, "That number doesn’t look right. Include the country code, like 92 321 4567890."),
  city: z.string().trim(),
  country: z.string().trim(),
  currency: z.enum(["USD", "PKR", "EUR", "GBP", "AED"]),
  termsDays: z.string().regex(/^\d{1,3}$/, "Choose payment terms"),
  prefersMethods: z.array(z.string()),
  notes: z.string(),
});

export type ClientFormValues = z.infer<typeof clientSchema>;

export const COUNTRIES: { value: string; label: string }[] = [
  { value: "US", label: "United States" },
  { value: "PK", label: "Pakistan" },
  { value: "AE", label: "United Arab Emirates" },
  { value: "GB", label: "United Kingdom" },
  { value: "SA", label: "Saudi Arabia" },
  { value: "CA", label: "Canada" },
  { value: "AU", label: "Australia" },
  { value: "DE", label: "Germany" },
];

export const TERMS_PRESETS = [0, 7, 14, 30];
export const termsLabel = (days: number) => (days === 0 ? "Due on receipt" : `Net ${days}`);

export function emptyClientForm(currency: Currency, termsDays: number): ClientFormValues {
  return { name: "", contactName: "", email: "", whatsapp: "", city: "", country: "US", currency, termsDays: String(termsDays), prefersMethods: [], notes: "" };
}

export function clientToForm(c: Client): ClientFormValues {
  return {
    name: c.name, contactName: c.contactName, email: c.email, whatsapp: c.whatsapp.replace(/^\+/, ""), city: c.city, country: c.country,
    currency: c.currency, termsDays: String(c.termsDays), prefersMethods: c.prefersMethods, notes: c.notes,
  };
}

const isKind = (k: string): k is PaymentMethodKind => k in METHOD_KINDS;

export function formToClient(v: ClientFormValues): Omit<Client, "id" | "createdAt"> {
  return {
    name: v.name.trim(), contactName: v.contactName.trim(), email: v.email.trim(), whatsapp: normalizeWhatsapp(v.whatsapp),
    city: v.city.trim(), country: v.country.trim(), currency: v.currency, termsDays: Number(v.termsDays),
    prefersMethods: v.prefersMethods.filter(isKind), notes: v.notes.trim(),
  };
}
