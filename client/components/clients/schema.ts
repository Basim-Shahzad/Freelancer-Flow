import { z } from "zod";
import type { ClientInput } from "@/lib/api/mappers/clients";
import type { Client, Currency } from "@/lib/types";

/** Client form schema and conversions. Form values are all strings (select/inputs); conversion happens on save. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const waDigits = (input: string) => input.replace(/\D/g, "");

/**
 * Light check only: phone-ish characters and 8 to 15 digits. Empty is allowed. The server is the authority:
 * it normalises Pakistani `03XXXXXXXXX` to `+923XXXXXXXXX`, accepts E.164 and rejects the rest with a 422.
 */
export function isValidWhatsapp(input: string): boolean {
  const s = input.trim();
  if (s === "") return true;
  if (!/^[+\d\s().-]+$/.test(s)) return false;
  const n = waDigits(s).length;
  return n >= 8 && n <= 15;
}

/** wa.me deep link, or null when there is no usable number. */
export function waLink(whatsapp: string): string | null {
  const d = waDigits(whatsapp);
  return d.length >= 8 ? `https://wa.me/${d}` : null;
}

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Enter the client’s name"),
  companyName: z.string().trim(),
  email: z.string().trim().min(1, "Enter an email address").refine((v) => EMAIL.test(v), "Enter a valid email address, like name@company.com"),
  phone: z.string().trim(),
  whatsapp: z.string().refine(isValidWhatsapp, "That number doesn’t look right. Include the country code, like +92 321 4567890, or a local number like 0321 4567890."),
  address: z.string().trim(),
  taxId: z.string().trim().max(255, "Tax ID is too long"),
  currency: z.enum(["USD", "PKR", "EUR", "GBP", "AED"]),
  termsDays: z.string().regex(/^\d{1,3}$/, "Choose payment terms"),
  notes: z.string(),
});

export type ClientFormValues = z.infer<typeof clientSchema>;

export const TERMS_PRESETS = [0, 7, 14, 30];
export const termsLabel = (days: number) => (days === 0 ? "Due on receipt" : `Net ${days}`);

export function emptyClientForm(currency: Currency, termsDays: number): ClientFormValues {
  return { name: "", companyName: "", email: "", phone: "", whatsapp: "", address: "", taxId: "", currency, termsDays: String(termsDays), notes: "" };
}

export function clientToForm(c: Client): ClientFormValues {
  return {
    name: c.name, companyName: c.companyName, email: c.email, phone: c.phone, whatsapp: c.whatsapp, address: c.address, taxId: c.taxId,
    currency: c.currency, termsDays: String(c.termsDays), notes: c.notes,
  };
}

export function formToClient(v: ClientFormValues): ClientInput {
  return {
    name: v.name.trim(), companyName: v.companyName.trim(), email: v.email.trim(), phone: v.phone.trim(), whatsapp: v.whatsapp.trim(),
    address: v.address.trim(), taxId: v.taxId.trim(), currency: v.currency, termsDays: Number(v.termsDays), notes: v.notes.trim(),
  };
}

/** API field names that differ from the form's. */
export const CLIENT_FIELD_ALIASES: Record<string, string> = { whatsappNumber: "whatsapp", paymentTermsDays: "termsDays" };
