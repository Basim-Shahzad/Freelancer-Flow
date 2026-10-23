/** Wire types for `/payment-methods` (camelCase, as sent). `details` is free-form per `type`; see `lib/payment-methods.ts`. */

export type PaymentMethodType =
  | "PAYONEER"
  | "ESFCA_WIRE"
  | "ELEVATE_PAY"
  | "WISE_TO_IBAN"
  | "PKR_BANK_TRANSFER"
  | "RAAST"
  | "JAZZCASH"
  | "EASYPAISA"
  | "BANK_TRANSFER"
  | "OTHER";

/** Normalised by the server (IBANs upper-cased, PK mobiles in +92 form, ...); every value is a string. */
export type PaymentMethodDetails = Record<string, string>;

export interface PaymentMethodResponse {
  id: string;
  type: PaymentMethodType;
  label: string;
  currency: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  details: PaymentMethodDetails;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMethodListResponse {
  paymentMethods: PaymentMethodResponse[];
}

export interface PaymentMethodCreate {
  type: PaymentMethodType;
  label: string;
  currency?: string | null;
  isDefault?: boolean;
  details: PaymentMethodDetails;
}

/** `type` is immutable; `details`, when sent, replaces the old details wholesale. */
export interface PaymentMethodUpdate {
  label?: string;
  currency?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  details?: PaymentMethodDetails;
}

export interface PaymentMethodOrder {
  ids: string[];
}
