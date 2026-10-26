import { calcTotals, deriveStatus, lineAmount } from "./invoice";
import type { BusinessProfile, Currency, Invoice, InvoiceDetail, InvoiceIssuer, InvoiceStatus } from "./types";

/**
 * What the invoice "paper" renders: a server-shaped model (all totals given, none recomputed). Server invoices map
 * straight onto it; the mock `Invoice` (create flow, portal, marketing and settings previews until steps 9-14) goes
 * through `legacyToDocInvoice`.
 */
export interface DocLine {
  id: string;
  description: string;
  qty: number;
  /** Minor units. */
  unitPrice: number;
  amount: number;
  /** Quantity is hours. */
  isTime: boolean;
}

export interface DocTaxLine {
  label: string;
  amount: number;
}

export interface DocInvoice {
  number: string;
  currency: Currency;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  lines: DocLine[];
  subtotal: number;
  discount: number;
  /** Collected taxes (withholding is separate). */
  taxes: DocTaxLine[];
  /** Deducted by the client when paying; already out of `total`. */
  withholding: number;
  total: number;
  paid: number;
  balance: number;
  taxNote?: string;
  note?: string;
  /** Free-text "additional note" beside the payment methods. */
  paymentInstructions?: string;
  /** The API's Money Rule line; falls back to `NO_PROCESSING`. */
  disclaimer?: string;
}

export function toDocInvoice(i: InvoiceDetail): DocInvoice {
  return {
    number: i.number,
    currency: i.currency,
    issueDate: i.issueDate,
    dueDate: i.dueDate,
    status: i.status,
    lines: i.items.map((l) => ({ id: l.id, description: l.description, qty: l.quantity, unitPrice: l.unitPrice, amount: l.amount, isTime: l.fromTime })),
    subtotal: i.subtotal,
    discount: i.discountAmount,
    taxes: i.taxes.filter((t) => !t.isWithholding).map((t) => ({ label: `${t.name} (${Number(t.rate)}%)`, amount: t.amount })),
    withholding: i.withholdingAmount,
    total: i.total,
    paid: i.amountPaid,
    balance: i.balanceDue,
    taxNote: i.taxNote,
    note: i.notes,
    paymentInstructions: i.paymentInstructions,
    disclaimer: i.paymentDisclaimer,
  };
}

/** The mock invoice, with totals computed locally (it has no server). Delete with the mock layer in step 14. */
export function legacyToDocInvoice(inv: Invoice, status: InvoiceStatus = deriveStatus(inv)): DocInvoice {
  const t = calcTotals(inv);
  return {
    number: inv.number,
    currency: inv.currency,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    status,
    lines: inv.lines.map((l) => ({ id: l.id, description: l.description, qty: l.qty, unitPrice: l.rate, amount: lineAmount(l), isTime: l.source?.type === "time" })),
    subtotal: t.subtotal,
    discount: t.discount,
    taxes: [{ label: `Tax (${inv.taxPercent}%)`, amount: t.tax }],
    withholding: 0,
    total: t.total,
    paid: t.paid,
    balance: t.balance,
    note: inv.note || undefined,
  };
}

/** The business block of a server invoice: the issuer as issued, falling back to the current profile for what it lacks. */
export function issuerToBusiness(issuer: InvoiceIssuer, business: BusinessProfile): BusinessProfile {
  return {
    ...business,
    businessName: issuer.businessName ?? business.businessName,
    ownerName: issuer.name ?? business.ownerName,
    address: issuer.address ?? business.address,
    taxId: issuer.taxRegistrationNumber ?? business.taxId,
  };
}
