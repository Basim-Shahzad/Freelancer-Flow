import type { InvoiceEditInput } from "@/lib/api/mappers/invoices";
import type { InvoiceDetail } from "@/lib/types";
import type { EditDraftValues } from "./schemas";

/** The form's starting values: the invoice as saved. Taxes and payment methods start as "keep". */
export function draftDefaults(invoice: InvoiceDetail): EditDraftValues {
  return {
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    discountRate: String(Number(invoice.discountRate)),
    taxMode: "keep",
    taxName: "",
    taxRate: "0",
    taxNote: invoice.taxNote ?? "",
    notes: invoice.notes ?? "",
    paymentInstructions: invoice.paymentInstructions ?? "",
    changeMethods: false,
    methodIds: [],
  };
}

const same = (a: string, b: string | undefined) => a.trim() === (b ?? "").trim();

/**
 * Only what the user changed, limited to the fields the API lets a draft change. An empty result means there is
 * nothing to save. (Line items, time entries, milestones and the project are not editable on a draft.)
 */
export function draftChanges(values: EditDraftValues, invoice: InvoiceDetail): InvoiceEditInput {
  const out: InvoiceEditInput = {};
  if (values.issueDate !== invoice.issueDate) out.issueDate = values.issueDate;
  if (values.dueDate !== invoice.dueDate) out.dueDate = values.dueDate;
  if (Number(values.discountRate.trim() || "0") !== Number(invoice.discountRate)) out.discountRate = values.discountRate;
  if (values.taxMode === "none") out.taxes = [];
  if (values.taxMode === "custom") out.taxes = [{ name: values.taxName, rate: values.taxRate }];
  if (!same(values.taxNote, invoice.taxNote)) out.taxNote = values.taxNote;
  if (!same(values.notes, invoice.notes)) out.notes = values.notes;
  if (!same(values.paymentInstructions, invoice.paymentInstructions)) out.paymentInstructions = values.paymentInstructions;
  if (values.changeMethods) out.paymentMethodIds = values.methodIds;
  return out;
}
