import { toDecimal, toMinor } from "@/lib/api/money";
import type { ProfileResponse, ProfileUpdate } from "@/lib/api/profile.types";
import type { User } from "@/lib/api/types";
import { CURRENCIES, type BusinessProfile, type Currency } from "@/lib/types";

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

/** API profile + account user -> the `BusinessProfile` view model the UI consumes. */
export function profileToBusiness(profile: ProfileResponse | null | undefined, user: User | null | undefined): BusinessProfile {
  const defaultCurrency = asCurrency(profile?.currency);
  return {
    businessName: profile?.businessName ?? "",
    ownerName: user?.fullName ?? "",
    email: user?.email ?? "",
    taxId: profile?.taxRegistrationNumber ?? "",
    address: profile?.businessAddress ?? "",
    defaultCurrency,
    defaultTermsDays: profile?.defaultPaymentTermsDays ?? 14,
    invoiceNumberFormat: profile?.invoiceNumberFormat ?? "",
    logoUrl: profile?.logoUrl ?? undefined,
    paymentInstructions: profile?.paymentInstructions ?? "",
    hourlyRate: hourlyToMinor(profile?.hourlyRate ?? null, defaultCurrency),
  };
}

const orNull = (s: string): string | null => (s.trim() === "" ? null : s.trim());

/**
 * Maps a UI patch onto the PATCH /profile body. `currency` is the profile's current default currency,
 * needed to encode `hourlyRate` when the patch does not change the currency.
 */
export function businessToProfileUpdate(patch: Partial<BusinessProfile>, currency: Currency): ProfileUpdate {
  const update: ProfileUpdate = {};
  if (patch.businessName !== undefined) update.businessName = orNull(patch.businessName);
  if (patch.taxId !== undefined) update.taxRegistrationNumber = orNull(patch.taxId);
  if (patch.address !== undefined) update.businessAddress = orNull(patch.address);
  if (patch.defaultCurrency !== undefined) update.currency = patch.defaultCurrency;
  if (patch.defaultTermsDays !== undefined) update.defaultPaymentTermsDays = patch.defaultTermsDays;
  if (patch.paymentInstructions !== undefined) update.paymentInstructions = orNull(patch.paymentInstructions);
  if (patch.invoiceNumberFormat !== undefined && patch.invoiceNumberFormat.trim()) update.invoiceNumberFormat = patch.invoiceNumberFormat.trim();
  if ("hourlyRate" in patch) {
    update.hourlyRate = patch.hourlyRate === undefined ? null : toDecimal(patch.hourlyRate, patch.defaultCurrency ?? currency);
  }
  return update;
}
