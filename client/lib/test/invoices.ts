import type {
  InvoiceEventResponse, InvoicePaymentMethodResponse, InvoiceResponse, InvoiceSendResponse, PaymentResponse,
} from "@/lib/api/invoices.types";

export function paymentResponseFixture(overrides: Partial<PaymentResponse> = {}): PaymentResponse {
  return { id: "pay1", invoiceId: "inv1", amount: "400.00", paidAt: "2026-10-10T00:00:00Z", method: "BANK_TRANSFER", reference: null, createdAt: "2026-10-10T08:00:00Z", ...overrides };
}

export function snapshotFixture(overrides: Partial<InvoicePaymentMethodResponse> = {}): InvoicePaymentMethodResponse {
  return {
    id: "pm1", type: "BANK_TRANSFER", label: "Bank transfer · IBAN", currency: "USD", payLink: null,
    details: { scheme: "IBAN", accountHolder: "Malik Studio", bankName: "HBL", country: "PK", currency: "USD", iban: "PK36HABB0000001123456702" },
    ...overrides,
  };
}

/** A sent, unpaid USD invoice of 1,000.00 (subtotal 1,000, no tax). */
export function invoiceResponseFixture(overrides: Partial<InvoiceResponse> = {}): InvoiceResponse {
  return {
    id: "inv1", invoiceNumber: "INV-0001", status: "SENT", displayStatus: "SENT", currency: "USD",
    issueDate: "2026-10-01T00:00:00Z", dueDate: "2026-11-15T00:00:00Z", clientId: "c1", projectId: "p1",
    client: { id: "c1", name: "Harbor Labs" }, project: { id: "p1", name: "Mobile app" }, retainerPeriodStart: null,
    issuer: { name: "Ayesha Malik", businessName: "Malik Studio", address: "Gulberg III, Lahore", taxRegistrationNumber: null, taxLabel: null, logoUrl: null },
    items: [{ id: "it1", description: "Build sprint", quantity: "20.00", unitPrice: "50.00", amount: "1000.00", timeEntryId: "t1", milestoneId: null }],
    payments: [], paymentMethods: [snapshotFixture()],
    subtotal: "1000.00", discountRate: "0.00", discountAmount: "0.00", taxes: [], taxNote: null, taxAmount: "0.00", withholdingAmount: "0.00",
    total: "1000.00", amountPaid: "0.00", balanceDue: "1000.00", isOverdue: false, notes: null, paymentInstructions: null,
    paymentDisclaimer: "Paylancr does not process payments. Pay the freelancer directly using the details below.",
    sentAt: "2026-10-01T09:00:00Z", viewedAt: null, paymentAt: null, createdAt: "2026-10-01T08:00:00Z", updatedAt: "2026-10-01T09:00:00Z",
    ...overrides,
  };
}

export function eventResponseFixture(overrides: Partial<InvoiceEventResponse> = {}): InvoiceEventResponse {
  return { id: "ev1", invoiceId: "inv1", eventType: "SENT", occurredAt: "2026-10-01T09:00:00Z", detail: null, ...overrides };
}

export function sendResponseFixture(overrides: Partial<InvoiceSendResponse> = {}): InvoiceSendResponse {
  return {
    portalUrl: "https://app.example/i/tok", pdfUrl: "https://api.example/portal/tok/pdf", whatsappUrl: "https://wa.me/15125550142?text=Hi",
    invoice: invoiceResponseFixture(), emailDelivered: true, ...overrides,
  };
}
