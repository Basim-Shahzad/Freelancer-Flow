/**
 * Wire types for `/invoices` and `/invoices/{id}/payments` (camelCase, as sent). Money is a decimal string
 * ("1250.50"); timestamps are UTC ISO strings. Mirrors `server/app/schemas/InvoiceSchema.py` / `PaymentSchema.py`.
 */
import type { PaymentMethodType } from "./payment-methods.types";

/** Stored status. `OVERDUE` is derived by the server and only appears in `displayStatus`. */
export type ApiInvoiceStatus = "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "WRITTEN_OFF" | "CANCELLED";
export type ApiInvoiceDisplayStatus = ApiInvoiceStatus | "OVERDUE";

/** What the UI may send. The server also accepts (and returns on old payments) `CARD`, `CHEQUE` and `PAYPAL`. */
export type ApiPaymentMethod =
  | "PAYONEER"
  | "ESFCA_WIRE"
  | "ELEVATE_PAY"
  | "WISE_TO_IBAN"
  | "BANK_TRANSFER"
  | "RAAST"
  | "JAZZCASH"
  | "EASYPAISA"
  | "CASH"
  | "CARD"
  | "CHEQUE"
  | "PAYPAL"
  | "OTHER";

export type ApiInvoiceEventType = "SENT" | "VIEWED" | "REMINDED" | "PAYMENT_RECORDED" | "PAID" | "WRITTEN_OFF" | "CANCELLED" | "EMAIL_FAILED";

export type ShareChannel = "email" | "whatsapp" | "link";

export interface InvoiceItemResponse {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  timeEntryId: string | null;
  milestoneId: string | null;
}

export interface InvoicePaymentMethodResponse {
  id: string;
  type: PaymentMethodType;
  label: string;
  currency: string | null;
  details: Record<string, unknown>;
  /** Payoneer payment-request link: a link-out only, never a charge. */
  payLink: string | null;
}

export interface InvoiceParty {
  id: string;
  name: string;
}

export interface InvoiceIssuer {
  name: string | null;
  businessName: string | null;
  address: string | null;
  taxRegistrationNumber: string | null;
  taxLabel: string | null;
  logoUrl: string | null;
}

export interface TaxLineResponse {
  name: string;
  rate: string;
  amount: string;
  isInclusive: boolean;
  isCompound: boolean;
  isWithholding: boolean;
}

export interface PaymentResponse {
  id: string;
  invoiceId: string;
  amount: string;
  paidAt: string;
  method: ApiPaymentMethod;
  reference: string | null;
  createdAt: string;
}

export interface InvoiceResponse {
  id: string;
  invoiceNumber: string;
  status: ApiInvoiceStatus;
  displayStatus: ApiInvoiceDisplayStatus;
  currency: string;
  issueDate: string;
  dueDate: string;
  clientId: string;
  projectId: string;
  client: InvoiceParty;
  project: InvoiceParty;
  retainerPeriodStart: string | null;
  issuer: InvoiceIssuer;
  items: InvoiceItemResponse[];
  payments: PaymentResponse[];
  paymentMethods: InvoicePaymentMethodResponse[];
  subtotal: string;
  discountRate: string;
  discountAmount: string;
  taxes: TaxLineResponse[];
  taxNote: string | null;
  taxAmount: string;
  withholdingAmount: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
  isOverdue: boolean;
  notes: string | null;
  paymentInstructions: string | null;
  paymentDisclaimer: string;
  sentAt: string | null;
  viewedAt: string | null;
  paymentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceListResponse {
  invoices: InvoiceResponse[];
  total: number;
}

export interface InvoiceEventResponse {
  id: string;
  invoiceId: string;
  eventType: ApiInvoiceEventType;
  occurredAt: string;
  detail: string | null;
}

export interface InvoiceEventListResponse {
  events: InvoiceEventResponse[];
}

export interface InvoiceSendRequest {
  channel: ShareChannel;
}

export interface InvoiceShareLinks {
  portalUrl: string;
  pdfUrl: string;
  whatsappUrl: string;
}

export interface InvoiceSendResponse extends InvoiceShareLinks {
  invoice: InvoiceResponse;
  /** Null when no email was attempted; false when it could not be sent (an `EMAIL_FAILED` event was logged). */
  emailDelivered: boolean | null;
}

export interface InvoiceWriteOffRequest {
  reason: string;
}

export interface PaymentCreate {
  amount: string;
  paidAt?: string;
  method: ApiPaymentMethod;
  reference?: string;
}
