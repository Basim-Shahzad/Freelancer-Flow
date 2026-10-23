import { TYPE_TO_KIND, toPaymentMethod } from "@/lib/api/mappers/payment-methods";
import type { PaymentMethodDetails, PaymentMethodResponse, PaymentMethodType } from "@/lib/api/payment-methods.types";
import type { PaymentMethod } from "@/lib/types";

/** Valid, server-normalised `details` for every type (BANK_TRANSFER has one per scheme: see `bankDetails`). */
export const detailsByType: Record<Exclude<PaymentMethodType, "BANK_TRANSFER">, PaymentMethodDetails> = {
  PAYONEER: { accountEmail: "ayesha@maliks.studio", paymentRequestUrl: "https://payoneer.com/pay/malik-studio" },
  ESFCA_WIRE: {
    beneficiaryName: "Ayesha Malik", bankName: "Standard Chartered Pakistan", iban: "PK36SCBL0000001123456702", swiftBic: "SCBLPKKX",
    bankAddress: "I.I. Chundrigar Road, Karachi", purposeOfPayment: "Export of IT services",
  },
  ELEVATE_PAY: { accountHolder: "Ayesha Malik", accountNumber: "123456789", routingNumber: "021000021", bankName: "JPMorgan Chase", accountType: "CHECKING" },
  WISE_TO_IBAN: { beneficiaryName: "Ayesha Malik", iban: "BE68539007547034", bankName: "Wise", note: "Send in EUR" },
  PKR_BANK_TRANSFER: { accountTitle: "Ayesha Malik", bankName: "HBL", iban: "PK36HABB0000001123456702", accountNumber: "0011-23456702" },
  RAAST: { accountTitle: "Ayesha Malik", raastId: "03005550214" },
  JAZZCASH: { mobileNumber: "+923005550214", accountTitle: "Ayesha Malik" },
  EASYPAISA: { mobileNumber: "+923215550214", accountTitle: "Ayesha Malik" },
  OTHER: { instructions: "Cash pickup at the studio, 10-5." },
};

const bankCommon = { accountHolder: "Ayesha Malik", bankName: "Test Bank", country: "US", currency: "USD" };

/** A valid BANK_TRANSFER `details` per scheme. */
export const bankDetails = {
  IBAN: { ...bankCommon, country: "BE", currency: "EUR", scheme: "IBAN", iban: "BE68539007547034", swiftBic: "TRWIBEB1" },
  ACH: { ...bankCommon, scheme: "ACH", routingNumber: "021000021", accountNumber: "123456789", accountType: "CHECKING" },
  UK_SORT_CODE: { ...bankCommon, country: "GB", currency: "GBP", scheme: "UK_SORT_CODE", sortCode: "231470", accountNumber: "12345678" },
  SWIFT_OTHER: { ...bankCommon, scheme: "SWIFT_OTHER", accountNumber: "9876543210", swiftBic: "DEUTDEFF", branchCode: "042" },
} satisfies Record<string, PaymentMethodDetails>;

const LABELS: Record<PaymentMethodType, string> = {
  PAYONEER: "Payoneer", ESFCA_WIRE: "ESFCA wire (USD)", ELEVATE_PAY: "Elevate Pay", WISE_TO_IBAN: "Wise (to IBAN)", PKR_BANK_TRANSFER: "PKR bank transfer",
  RAAST: "Raast", JAZZCASH: "JazzCash", EASYPAISA: "Easypaisa", BANK_TRANSFER: "Bank transfer", OTHER: "Other",
};

/** A `GET /payment-methods/{id}` response. */
export function paymentMethodResponseFixture(type: PaymentMethodType = "PAYONEER", overrides: Partial<PaymentMethodResponse> = {}): PaymentMethodResponse {
  return {
    id: `pm-${TYPE_TO_KIND[type]}`, type, label: LABELS[type], currency: null, isDefault: false, isActive: true, sortOrder: 0,
    details: type === "BANK_TRANSFER" ? bankDetails.IBAN : detailsByType[type],
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", ...overrides,
  };
}

/**
 * A realistic list in server order: Payoneer (default), ESFCA, PKR bank, Raast, and a disabled JazzCash.
 * Ids are `pm-<kind>`: pm-payoneer, pm-esfca, pm-pkrbank, pm-raast, pm-jazzcash.
 */
export function paymentMethodResponses(): PaymentMethodResponse[] {
  return (["PAYONEER", "ESFCA_WIRE", "PKR_BANK_TRANSFER", "RAAST", "JAZZCASH"] as const).map((t, i) =>
    paymentMethodResponseFixture(t, { sortOrder: i, isDefault: i === 0, isActive: t !== "JAZZCASH" }),
  );
}

export const methodFixtures = (): PaymentMethod[] => paymentMethodResponses().map(toPaymentMethod);
