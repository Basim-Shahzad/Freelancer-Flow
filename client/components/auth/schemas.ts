import { z } from "zod";
import { CURRENCIES } from "@/lib/types";

export const COUNTRIES = [
  { code: "PK", label: "Pakistan" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "GB", label: "United Kingdom" },
  { code: "US", label: "United States" },
  { code: "XX", label: "Somewhere else" },
] as const;
export type CountryCode = (typeof COUNTRIES)[number]["code"];
export const COUNTRY_CODES = COUNTRIES.map((c) => c.code) as [CountryCode, ...CountryCode[]];
export const countryLabel = (code: string) => COUNTRIES.find((c) => c.code === code)?.label ?? code;

/** sessionStorage key: the country chosen at signup, used to prefill onboarding. */
export const COUNTRY_HINT_KEY = "paylancr:signup-country";

const EMAIL_MSG = "Enter a valid email address, like name@example.com.";
const email = z.string().trim().min(1, "Enter your email address.").pipe(z.email(EMAIL_MSG));

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name."),
  email,
  password: z.string().min(10, "Use 10 characters or more."),
  country: z.enum(COUNTRY_CODES),
  terms: z.boolean().refine((v) => v, "Accept the Terms and Privacy Policy to continue."),
});
export type SignUpValues = z.infer<typeof signUpSchema>;

export const logInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
  keep: z.boolean(),
});
export type LogInValues = z.infer<typeof logInSchema>;

export const forgotSchema = z.object({ email });
export type ForgotValues = z.infer<typeof forgotSchema>;

/* ----------------------------------------------------------- Onboarding */

export const NTN_RE = /^\d{7}-?\d$/;

export const businessSchema = z.object({
  businessName: z.string().trim().min(2, "Enter your business or studio name."),
  ownerName: z.string().trim().min(2, "Enter your name."),
  country: z.enum(COUNTRY_CODES),
  city: z.string().trim().min(2, "Enter your city."),
  address: z.string().trim().max(240, "Keep the address under 240 characters."),
  taxId: z.string().trim().refine((v) => v === "" || NTN_RE.test(v), "An NTN looks like 1234567-8."),
});
export type BusinessValues = z.infer<typeof businessSchema>;

export const DISPLAY_CHOICES = ["both", "usd", "pkr"] as const;
export type DisplayChoice = (typeof DISPLAY_CHOICES)[number];

export const currencySchema = z.object({
  invoiceCurrency: z.enum(CURRENCIES),
  display: z.enum(DISPLAY_CHOICES),
});
export type CurrencyValues = z.infer<typeof currencySchema>;

export const clientSchema = z
  .object({
    contactName: z.string().trim(),
    company: z.string().trim(),
    email: z.string().trim(),
    whatsapp: z.string().trim(),
    city: z.string().trim(),
    currency: z.enum(CURRENCIES),
  })
  .superRefine((v, ctx) => {
    if (isClientBlank(v)) return; // skippable: an untouched step is fine
    const add = (path: keyof ClientValues, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (v.contactName.length < 2) add("contactName", "Enter the contact's name.");
    if (!v.email) add("email", "Enter the client's email address.");
    else if (!z.email().safeParse(v.email).success) add("email", EMAIL_MSG);
    const digits = v.whatsapp.replace(/\D/g, "");
    if (v.whatsapp && (digits.length < 7 || digits.length > 15 || /[^\d\s+()-]/.test(v.whatsapp))) {
      add("whatsapp", "Use the country code and digits only, like 92 321 4567890.");
    }
  });
export type ClientValues = z.infer<typeof clientSchema>;

/** True when no client detail has been typed (so the step may be skipped). */
export function isClientBlank(v: Pick<ClientValues, "contactName" | "company" | "email" | "whatsapp" | "city">): boolean {
  return ![v.contactName, v.company, v.email, v.whatsapp, v.city].some((s) => s.trim() !== "");
}
