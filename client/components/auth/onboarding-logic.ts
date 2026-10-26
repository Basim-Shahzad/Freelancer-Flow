import type { MethodDraft } from "@/lib/api/mappers/payment-methods";
import { METHOD_KINDS } from "@/lib/payment-methods";
import type { FxRates } from "@/lib/api/mappers/exchange-rates";
import { convertForDisplay } from "@/lib/fx";
import type { ClientInput } from "@/lib/api/mappers/clients";
import type { BusinessProfile, Currency, PaymentMethodKind } from "@/lib/types";
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
    client: { name: "", company: "", email: "", whatsapp: "", currency: "USD" },
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

/** 1,000 USD, or its reference-rate PKR equivalent; without rates the same figure is shown in the chosen currency. */
export function previewAmount(invoice: Currency, rates?: FxRates | null): number {
  return invoice === "PKR" ? (convertForDisplay(100000, "USD", "PKR", rates)?.amount ?? 100000) : 100000;
}

const DISPLAY_TEXT: Record<DisplayChoice, string> = { both: "PKR and USD together", usd: "USD only", pkr: "PKR only" };

export function buildSummary(d: OnboardingData): { k: string; v: string }[] {
  const names = methodsToCreate(d.methods).map((m) => METHOD_KINDS[m.kind].label);
  return [
    { k: "Business", v: `${d.business.businessName} · ${d.business.city}` },
    { k: "Currency", v: `Bills in ${d.currency.invoiceCurrency} · shows ${DISPLAY_TEXT[d.currency.display]}` },
    { k: "Payment methods", v: names.length ? names.join(", ") : "None yet. Add one in Settings before sending an invoice." },
    { k: "First client", v: isClientBlank(d.client) ? "Skipped for now" : [d.client.company, d.client.name].filter(Boolean).join(" · ") },
  ];
}

export interface Completion {
  business: Partial<BusinessProfile>;
  client?: ClientInput;
  methods: MethodDraft[];
}

/** What `finish` has already done, so a retry after a partial failure resumes instead of repeating finished steps. */
export interface CompletionProgress {
  profile: boolean;
  client: boolean;
  /** Number of payment methods already created. */
  methods: number;
}

export const newProgress = (): CompletionProgress => ({ profile: false, client: false, methods: 0 });

export interface CompletionSteps {
  saveProfile(business: Partial<BusinessProfile>, country: CountryCode): Promise<void>;
  addClient(client: NonNullable<Completion["client"]>): Promise<void>;
  addMethod(method: MethodDraft, index: number): Promise<void>;
}

/** A payment method could not be created. Carries the draft so the wizard can send the user back to its form. */
export class MethodCreateError extends Error {
  constructor(readonly draft: MethodDraft, readonly cause: unknown) {
    super(cause instanceof Error ? cause.message : "Could not save a payment method");
    this.name = "MethodCreateError";
  }
}

/**
 * Runs the onboarding writes in order and records each finished step in `progress` (mutated), so calling it again
 * after a failure skips what already succeeded. The profile goes first: "onboarded" is derived from it, so a later
 * failure can never strand the user in the wizard.
 */
export async function runCompletion(c: Completion, country: CountryCode, steps: CompletionSteps, progress: CompletionProgress): Promise<void> {
  if (!progress.profile) {
    await steps.saveProfile(c.business, country);
    progress.profile = true;
  }
  if (!progress.client) {
    if (c.client) await steps.addClient(c.client);
    progress.client = true;
  }
  for (const [i, m] of c.methods.entries()) {
    if (i < progress.methods) continue;
    try {
      await steps.addMethod(m, i);
    } catch (e) {
      throw new MethodCreateError(m, e);
    }
    progress.methods = i + 1;
  }
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
          name: c.name, companyName: c.company, email: c.email, whatsapp: wa ? `+${wa}` : "",
          phone: "", address: "", taxId: "", currency: c.currency, termsDays: 14, notes: "",
        },
    methods,
  };
}
