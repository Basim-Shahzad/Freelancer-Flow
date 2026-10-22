/** Wire types for `GET/PATCH /profile` (FreelancerProfileResponse / FreelancerProfileUpdate in openapi.json). */

export interface TaxInput {
  name: string;
  /** Percent as a decimal string (15 == 15%). */
  rate: string;
  isInclusive?: boolean;
  isCompound?: boolean;
  isWithholding?: boolean;
}

export interface ProfileResponse {
  id: string;
  /** Decimal string in `currency`, e.g. "40.50". */
  hourlyRate: string | null;
  type: string | null;
  currency: string | null;
  /** ISO-3166 alpha-2. */
  country: string | null;
  timezone: string;
  businessName: string | null;
  businessAddress: string | null;
  taxRegistrationNumber: string | null;
  taxLabel: string | null;
  taxBasis: "accrual" | "cash" | string;
  paymentInstructions: string | null;
  invoiceNumberFormat: string;
  logoUrl: string | null;
  defaultPaymentTermsDays: number;
  defaultTaxes: TaxInput[];
  bankBalance: string | null;
  bankBalanceUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** PATCH body: every field optional, `null` clears a nullable field. Money is sent as a decimal string. */
export interface ProfileUpdate {
  hourlyRate?: string | null;
  type?: string | null;
  currency?: string | null;
  businessName?: string | null;
  businessAddress?: string | null;
  country?: string | null;
  timezone?: string | null;
  taxRegistrationNumber?: string | null;
  taxLabel?: string | null;
  taxBasis?: "accrual" | "cash" | null;
  paymentInstructions?: string | null;
  invoiceNumberFormat?: string | null;
  logoUrl?: string | null;
  defaultPaymentTermsDays?: number | null;
  defaultTaxes?: TaxInput[] | null;
  bankBalance?: string | null;
}
