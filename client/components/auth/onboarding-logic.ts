import type { MethodDraft } from "@/components/domain/payment-method-form";
import { METHOD_KINDS } from "@/lib/payment-methods";
import { convertMinor } from "@/lib/fx";
import type { BusinessProfile, Client, Currency, PaymentMethodKind } from "@/lib/types";
import {
  type BusinessValues, type ClientValues, type CurrencyValues, type DisplayChoice, type CountryCode,
  countryLabel, isClientBlank,
} from "./schemas";

export interface MethodsValues {
  /** Kinds the user ticked, in the order they were ticked. */
  selected: PaymentMethodKind[];
  /** Latest (possibly unsaved) form values per kind. */
  drafts: Partial<Record<PaymentMethodKind, MethodDraft>>;
  /** Kinds whose details were saved with the form's submit button. */
  saved: PaymentMethodKind[];
}

export interface OnboardingData {
  business: BusinessValues;
  currency: CurrencyValues;
  methods: MethodsValues;
  client: ClientValues;
}

export const STEP_TITLES = ["Business profile", "Currency", "Payment methods", "First client", "Ready"] as const;
export const STEP_COUNT = STEP_TITLES.length;

export function initialData(opts: { name?: string; country?: CountryCode }): OnboardingData {
  const country = opts.country ?? "PK";
  return {
    business: { businessName: "", ownerName: opts.name ?? "", country, city: "", address: "", taxId: "" },
    currency: { invoiceCurrency: "USD", display: "both" },
    methods: { selected: [], drafts: {}, saved: [] },
    client: { contactName: "", company: "", email: "", whatsapp: "", city: "", currency: "USD" },
  };
}

/** Methods step: every ticked method needs its details saved before continuing. */
export function validateMethods(m: MethodsValues): { ok: true } | { ok: false; message: string; firstMissing?: PaymentMethodKind } {
  if (m.selected.length === 0) return { ok: false, message: "Pick at least one method, or skip this step and add methods later in Settings." };
  const missing = m.selected.filter((k) => !m.saved.includes(k));
  const first = missing[0];
  if (first === undefined) return { ok: true };
  const names = missing.map((k) => METHOD_KINDS[k].label).join(", ");
  return { ok: false, firstMissing: first, message: `Save the details for ${names}, or untick ${missing.length > 1 ? "them" : "it"}.` };
}

/** Methods that will actually be created: ticked AND saved. */
export function methodsToCreate(m: MethodsValues): MethodDraft[] {
  return m.selected.flatMap((k) => (m.saved.includes(k) && m.drafts[k] ? [m.drafts[k] as MethodDraft] : []));
}

/** Which currency (if any) to show as the labelled estimate under an amount in the invoice currency. */
export function estimateCurrency(invoice: Currency, display: DisplayChoice): Currency | undefined {
  const target: Currency = display === "both" ? (invoice === "PKR" ? "USD" : "PKR") : (display.toUpperCase() as Currency);
  return target === invoice ? undefined : target;
}

export function previewAmount(invoice: Currency): number {
  return invoice === "PKR" ? convertMinor(100000, "USD", "PKR") : 100000;
}

const DISPLAY_TEXT: Record<DisplayChoice, string> = { both: "PKR and USD together", usd: "USD only", pkr: "PKR only" };

export function buildSummary(d: OnboardingData): { k: string; v: string }[] {
  const names = methodsToCreate(d.methods).map((m) => METHOD_KINDS[m.kind].label);
  return [
    { k: "Business", v: `${d.business.businessName} · ${d.business.city}` },
    { k: "Currency", v: `Bills in ${d.currency.invoiceCurrency} · shows ${DISPLAY_TEXT[d.currency.display]}` },
    { k: "Payment methods", v: names.length ? names.join(", ") : "None yet. Add one in Settings before sending an invoice." },
    { k: "First client", v: isClientBlank(d.client) ? "Skipped for now" : [d.client.company, d.client.contactName].filter(Boolean).join(" · ") },
  ];
}

export interface Completion {
  business: Partial<BusinessProfile>;
  client?: Omit<Client, "id" | "createdAt">;
  /** First goes through completeOnboarding; the rest through upsertMethod. */
  methods: MethodDraft[];
}

export function buildCompletion(d: OnboardingData, userEmail: string): Completion {
  const b = d.business;
  const address = [b.address, b.city, countryLabel(b.country)].filter((s) => s.trim()).join(", ");
  const methods = methodsToCreate(d.methods);
  const c = d.client;
  const wa = c.whatsapp.replace(/^\s*\+/, "").trim();
  return {
    business: {
      businessName: b.businessName, ownerName: b.ownerName, email: userEmail, phone: "", taxId: b.taxId, address,
      defaultCurrency: d.currency.invoiceCurrency,
    },
    client: isClientBlank(c)
      ? undefined
      : {
          name: c.company || c.contactName, contactName: c.contactName, email: c.email, whatsapp: wa ? `+${wa}` : "",
          city: c.city, country: b.country, currency: c.currency, termsDays: 14,
          prefersMethods: methods.map((m) => m.kind), notes: "",
        },
    methods,
  };
}
