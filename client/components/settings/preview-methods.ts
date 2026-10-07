import { formatInvoiceNumber } from "@/lib/invoice";
import { todayISO } from "@/lib/dates";
import { byDateDesc } from "@/lib/selectors";
import type { MethodDraft } from "@/components/domain/payment-method-form";
import type { BusinessProfile, Invoice, PaymentMethod, PaymentMethodKind } from "@/lib/types";

export type Editing = { mode: "edit"; id: string } | { mode: "new"; kind: PaymentMethodKind };

export const editingKey = (e: Editing | null) => (e ? (e.mode === "edit" ? `edit:${e.id}` : `new:${e.kind}`) : "");

const hasValues = (fields: Record<string, string>) => Object.values(fields).some((v) => v.trim() !== "");

/**
 * Methods the client would see, in order: enabled ones only, with the in-progress edit
 * (unsaved) applied. A brand-new method appears at the end once it has any content.
 */
export function previewMethods(methods: PaymentMethod[], editing: Editing | null, draft: MethodDraft | null): PaymentMethod[] {
  const applied = methods.map((m) => (editing?.mode === "edit" && editing.id === m.id && draft ? { ...m, ...draft, fields: draft.fields } : m)).filter((m) => m.enabled);
  if (editing?.mode === "new" && draft && hasValues(draft.fields)) {
    applied.push({ id: "draft", kind: draft.kind, scheme: draft.scheme, label: draft.label, fields: draft.fields, enabled: true, isDefault: false });
  }
  return applied;
}

/** Most recent real (non-draft) invoice, else any invoice, else undefined. */
export function pickPreviewInvoice(invoices: Invoice[]): Invoice | undefined {
  const sorted = [...invoices].sort(byDateDesc);
  return sorted.find((i) => i.status !== "draft") ?? sorted[0];
}

export function sampleInvoice(business: BusinessProfile): Invoice {
  return {
    id: "sample", number: formatInvoiceNumber(business.invoicePrefix, business.nextInvoiceNumber), clientId: "", currency: business.defaultCurrency,
    status: "unpaid", issueDate: todayISO(), dueDate: todayISO(), lines: [], taxPercent: 0, discount: 0, paymentMethodIds: [], note: "", shareToken: "sample", payments: [], events: [],
  };
}
