import { toDecimal, toMinor } from "@/lib/api/money";
import type { ProfileResponse, ProfileUpdate } from "@/lib/api/profile.types";
import type { User } from "@/lib/api/types";
import { CURRENCIES, type BusinessLocal, type BusinessProfile, type Currency } from "@/lib/types";

export const LOCAL_BUSINESS_KEYS = ["phone", "footerNote", "invoicePrefix", "nextInvoiceNumber", "logoName"] as const satisfies readonly (keyof BusinessLocal)[];

/** Onboarding is done once the profile carries a business name (the first thing the wizard collects). */
export function isProfileComplete(profile: ProfileResponse | null | undefined): boolean {
  return !!profile?.businessName?.trim();
}

const asCurrency = (c: string | null | undefined): Currency => (CURRENCIES.find((x) => x === c) ?? "USD");

function hourlyToMinor(rate: string | null, currency: Currency): number | undefined {
  if (!rate) return undefined;
  try {
    const minor = toMinor(rate, currency);
    return minor > 0 ? minor : undefined;
  } catch {
    return undefined;
  }
}

/** API profile + account user + local-only fields -> the `BusinessProfile` view model the UI consumes. */
export function profileToBusiness(profile: ProfileResponse | null | undefined, user: User | null | undefined, local: BusinessLocal): BusinessProfile {
  const defaultCurrency = asCurrency(profile?.currency);
  return {
    businessName: profile?.businessName ?? "",
    ownerName: user?.fullName ?? "",
    email: user?.email ?? "",
    phone: local.phone,
    taxId: profile?.taxRegistrationNumber ?? "",
    address: profile?.businessAddress ?? "",
    defaultCurrency,
    defaultTermsDays: profile?.defaultPaymentTermsDays ?? 14,
    invoicePrefix: local.invoicePrefix,
    nextInvoiceNumber: local.nextInvoiceNumber,
    footerNote: local.footerNote,
    logoName: local.logoName,
    hourlyRate: hourlyToMinor(profile?.hourlyRate ?? null, defaultCurrency),
  };
}

const orNull = (s: string): string | null => (s.trim() === "" ? null : s.trim());

/**
 * Splits a UI patch into the API part and the local-only part. `currency` is the profile's current default
 * currency, needed to encode `hourlyRate` when the patch does not change the currency.
 */
export function splitBusinessPatch(patch: Partial<BusinessProfile>, currency: Currency): { remote: ProfileUpdate; local: Partial<BusinessLocal> } {
  const remote: ProfileUpdate = {};
  if (patch.businessName !== undefined) remote.businessName = orNull(patch.businessName);
  if (patch.taxId !== undefined) remote.taxRegistrationNumber = orNull(patch.taxId);
  if (patch.address !== undefined) remote.businessAddress = orNull(patch.address);
  if (patch.defaultCurrency !== undefined) remote.currency = patch.defaultCurrency;
  if (patch.defaultTermsDays !== undefined) remote.defaultPaymentTermsDays = patch.defaultTermsDays;
  if ("hourlyRate" in patch) {
    remote.hourlyRate = patch.hourlyRate === undefined ? null : toDecimal(patch.hourlyRate, patch.defaultCurrency ?? currency);
  }
  const local: Partial<BusinessLocal> = {};
  for (const k of LOCAL_BUSINESS_KEYS) if (k in patch) (local as Record<string, unknown>)[k] = patch[k];
  return { remote, local };
}
