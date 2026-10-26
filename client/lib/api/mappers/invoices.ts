import { toDecimal, toMinor } from "@/lib/api/money";
import type {
  ApiInvoiceDisplayStatus, ApiInvoiceEventType, ApiPaymentMethod, InvoiceEventResponse, InvoicePaymentMethodResponse, InvoiceResponse,
  InvoiceSendResponse, PaymentCreate, PaymentResponse, TaxLineResponse,
} from "@/lib/api/invoices.types";
import { apiDateToIso } from "@/lib/api/mappers/projects";
import { KIND_TO_TYPE, TYPE_TO_KIND } from "@/lib/api/mappers/payment-methods";
import type { PaymentMethodType } from "@/lib/api/payment-methods.types";
import { DEFAULT_BANK_SCHEME } from "@/lib/payment-methods";
import {
  CURRENCIES, type BankScheme, type Currency, type InvoiceDetail, type InvoicePayment, type InvoiceShare, type InvoiceStatus,
  type InvoiceTaxLine, type InvoiceTimelineEvent, type PaymentMethod,
} from "@/lib/types";

/** The server's seven `displayStatus` values onto the chip statuses. */
export const DISPLAY_STATUS: Record<ApiInvoiceDisplayStatus, InvoiceStatus> = {
  DRAFT: "draft",
  SENT: "unpaid",
  PARTIALLY_PAID: "partial",
  PAID: "paid",
  WRITTEN_OFF: "written_off",
  CANCELLED: "void",
  OVERDUE: "overdue",
};

export const statusFromApi = (s: ApiInvoiceDisplayStatus): InvoiceStatus => DISPLAY_STATUS[s];

/** The `status` query value for a chip status (`unpaid` has no single value; the list hook asks for SENT and PARTIALLY_PAID). */
export const STATUS_TO_API: Partial<Record<InvoiceStatus, ApiInvoiceDisplayStatus>> = {
  draft: "DRAFT",
  partial: "PARTIALLY_PAID",
  paid: "PAID",
  written_off: "WRITTEN_OFF",
  void: "CANCELLED",
  overdue: "OVERDUE",
};

const asCurrency = (c: string): Currency => CURRENCIES.find((x) => x === c) ?? "USD";

const SCHEMES: BankScheme[] = ["IBAN", "ACH", "UK_SORT_CODE", "SWIFT_OTHER"];

/** A payment method as snapshotted onto an invoice, in the shape the document renders. */
export function snapshotToMethod(s: InvoicePaymentMethodResponse, index = 0): PaymentMethod {
  const kind = TYPE_TO_KIND[s.type] ?? "other";
  const { scheme, ...rest } = s.details ?? {};
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(rest)) if (typeof v === "string") fields[k] = v;
  return {
    id: s.id,
    kind,
    label: s.label,
    scheme: kind === "bank" ? (SCHEMES.includes(scheme as BankScheme) ? (scheme as BankScheme) : DEFAULT_BANK_SCHEME) : undefined,
    enabled: true,
    isDefault: false,
    sortOrder: index,
    currency: s.currency ?? undefined,
    fields,
    payLink: s.payLink ?? undefined,
  };
}

export function toPayment(p: PaymentResponse, currency: Currency): InvoicePayment {
  return { id: p.id, amount: toMinor(p.amount, currency), paidAt: p.paidAt, method: p.method, reference: p.reference ?? undefined };
}

function toTaxLine(t: TaxLineResponse, currency: Currency): InvoiceTaxLine {
  return { name: t.name, rate: t.rate, amount: toMinor(t.amount, currency), isInclusive: t.isInclusive, isWithholding: t.isWithholding };
}

const text = (v: string | null | undefined): string | undefined => (v ? v : undefined);

export function responseToInvoice(r: InvoiceResponse): InvoiceDetail {
  const currency = asCurrency(r.currency);
  const m = (v: string) => toMinor(v, currency);
  return {
    id: r.id,
    number: r.invoiceNumber,
    status: statusFromApi(r.displayStatus),
    currency,
    issueDate: apiDateToIso(r.issueDate) ?? r.issueDate,
    dueDate: apiDateToIso(r.dueDate) ?? r.dueDate,
    clientId: r.clientId,
    projectId: r.projectId,
    client: { id: r.client.id, name: r.client.name },
    project: { id: r.project.id, name: r.project.name },
    issuer: {
      name: text(r.issuer.name), businessName: text(r.issuer.businessName), address: text(r.issuer.address),
      taxRegistrationNumber: text(r.issuer.taxRegistrationNumber), taxLabel: text(r.issuer.taxLabel),
    },
    items: r.items.map((i) => ({
      id: i.id, description: i.description, quantity: Number(i.quantity), unitPrice: m(i.unitPrice), amount: m(i.amount), fromTime: i.timeEntryId !== null,
    })),
    payments: r.payments.map((p) => toPayment(p, currency)),
    methods: r.paymentMethods.map(snapshotToMethod),
    subtotal: m(r.subtotal),
    discountRate: r.discountRate,
    discountAmount: m(r.discountAmount),
    taxes: r.taxes.map((t) => toTaxLine(t, currency)),
    taxNote: text(r.taxNote),
    taxAmount: m(r.taxAmount),
    withholdingAmount: m(r.withholdingAmount),
    total: m(r.total),
    amountPaid: m(r.amountPaid),
    balanceDue: m(r.balanceDue),
    notes: text(r.notes),
    paymentInstructions: text(r.paymentInstructions),
    paymentDisclaimer: r.paymentDisclaimer,
    sentAt: text(r.sentAt),
    viewedAt: text(r.viewedAt),
    paymentAt: text(r.paymentAt),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export function responseToShare(r: InvoiceSendResponse): InvoiceShare {
  return { portalUrl: r.portalUrl, pdfUrl: r.pdfUrl, whatsappUrl: r.whatsappUrl, emailDelivered: r.emailDelivered, invoice: responseToInvoice(r.invoice) };
}

/* ------------------------------------------------------------------- events */

export const EVENT_LABEL: Record<ApiInvoiceEventType, string> = {
  SENT: "Sent to your client",
  VIEWED: "Opened by your client",
  REMINDED: "Reminder sent",
  PAYMENT_RECORDED: "Payment recorded",
  PAID: "Paid in full",
  WRITTEN_OFF: "Written off",
  CANCELLED: "Cancelled",
  EMAIL_FAILED: "Email could not be delivered",
};

export function responseToEvent(e: InvoiceEventResponse): InvoiceTimelineEvent {
  return { id: e.id, type: e.eventType, at: e.occurredAt, detail: text(e.detail) };
}

/* ----------------------------------------------------------------- payments */

/** Methods the record-payment form offers. CARD, CHEQUE and PAYPAL still exist on old payments but are not offered. */
export const RECORDABLE_METHODS: ApiPaymentMethod[] = [
  "BANK_TRANSFER", "PAYONEER", "ESFCA_WIRE", "ELEVATE_PAY", "WISE_TO_IBAN", "RAAST", "JAZZCASH", "EASYPAISA", "CASH", "OTHER",
];

export const PAYMENT_METHOD_LABEL: Record<ApiPaymentMethod, string> = {
  BANK_TRANSFER: "Bank transfer",
  PAYONEER: "Payoneer",
  ESFCA_WIRE: "ESFCA wire",
  ELEVATE_PAY: "Elevate Pay",
  WISE_TO_IBAN: "Wise",
  RAAST: "Raast",
  JAZZCASH: "JazzCash",
  EASYPAISA: "Easypaisa",
  CASH: "Cash",
  CARD: "Card",
  CHEQUE: "Cheque",
  PAYPAL: "PayPal",
  OTHER: "Other",
};

/** A saved method's type onto the payment `method` enum, which has no `PKR_BANK_TRANSFER`. */
export const savedTypeToPaymentMethod = (t: PaymentMethodType): ApiPaymentMethod => (t === "PKR_BANK_TRANSFER" ? "BANK_TRANSFER" : t);

/** The method to pre-select: the first one listed on the invoice that can be recorded, else bank transfer. */
export function preferredPaymentMethod(methods: Pick<PaymentMethod, "kind">[]): ApiPaymentMethod {
  const first = methods.map((m) => savedTypeToPaymentMethod(KIND_TO_TYPE[m.kind])).find((m) => RECORDABLE_METHODS.includes(m));
  return first ?? "BANK_TRANSFER";
}

export interface PaymentInput {
  /** Minor units. */
  amount: number;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  method: ApiPaymentMethod;
  reference: string;
}

/** Today's payments omit `paidAt` (the server stamps "now"); a past date is sent as that day's UTC midnight. */
export function toPaymentCreate(input: PaymentInput, currency: Currency, today: string): PaymentCreate {
  const reference = input.reference.trim();
  return {
    amount: toDecimal(input.amount, currency),
    method: input.method,
    ...(input.date !== today ? { paidAt: `${input.date}T00:00:00Z` } : {}),
    ...(reference ? { reference } : {}),
  };
}
