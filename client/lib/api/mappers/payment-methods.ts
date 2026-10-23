import { DEFAULT_BANK_SCHEME, fieldsFor } from "@/lib/payment-methods";
import type { BankScheme, PaymentMethod, PaymentMethodKind } from "@/lib/types";
import type { PaymentMethodCreate, PaymentMethodDetails, PaymentMethodResponse, PaymentMethodType, PaymentMethodUpdate } from "../payment-methods.types";

export const KIND_TO_TYPE: Record<PaymentMethodKind, PaymentMethodType> = {
  payoneer: "PAYONEER",
  esfca: "ESFCA_WIRE",
  elevate: "ELEVATE_PAY",
  wise: "WISE_TO_IBAN",
  pkrbank: "PKR_BANK_TRANSFER",
  raast: "RAAST",
  jazzcash: "JAZZCASH",
  easypaisa: "EASYPAISA",
  bank: "BANK_TRANSFER",
  other: "OTHER",
};

export const TYPE_TO_KIND = Object.fromEntries(Object.entries(KIND_TO_TYPE).map(([k, t]) => [t, k])) as Record<PaymentMethodType, PaymentMethodKind>;

const SCHEMES: BankScheme[] = ["IBAN", "ACH", "UK_SORT_CODE", "SWIFT_OTHER"];
const isScheme = (v: unknown): v is BankScheme => SCHEMES.includes(v as BankScheme);

/** What the form edits: everything a method needs apart from its server-owned state. */
export interface MethodDraft {
  kind: PaymentMethodKind;
  scheme?: BankScheme;
  label: string;
  fields: Record<string, string>;
}

/**
 * The details object to send: only the keys this kind (and scheme) accepts, trimmed, empty values dropped. The
 * server rejects unknown keys (and keys of another scheme), and a PATCH replaces `details` wholesale.
 */
export function toDetails(kind: PaymentMethodKind, scheme: BankScheme | undefined, fields: Record<string, string>): PaymentMethodDetails {
  const s = kind === "bank" ? (scheme ?? DEFAULT_BANK_SCHEME) : undefined;
  const out: PaymentMethodDetails = {};
  for (const f of fieldsFor(kind, s)) {
    const v = fields[f.key]?.trim();
    if (v) out[f.key] = v;
  }
  if (s) out.scheme = s;
  return out;
}

export function toPaymentMethod(r: PaymentMethodResponse): PaymentMethod {
  const kind = TYPE_TO_KIND[r.type];
  const { scheme, ...rest } = r.details ?? {};
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(rest)) if (typeof v === "string") fields[k] = v;
  return {
    id: r.id,
    kind,
    label: r.label,
    scheme: kind === "bank" ? (isScheme(scheme) ? scheme : DEFAULT_BANK_SCHEME) : undefined,
    enabled: r.isActive,
    isDefault: r.isDefault,
    sortOrder: r.sortOrder,
    currency: r.currency ?? undefined,
    fields,
  };
}

export function toCreate(draft: MethodDraft, isDefault?: boolean): PaymentMethodCreate {
  return {
    type: KIND_TO_TYPE[draft.kind],
    label: draft.label.trim(),
    ...(isDefault ? { isDefault } : {}),
    details: toDetails(draft.kind, draft.scheme, draft.fields),
  };
}

/** `type` cannot change, so an update is a label and a full replacement of the details. */
export function toUpdate(draft: MethodDraft): PaymentMethodUpdate {
  return { label: draft.label.trim(), details: toDetails(draft.kind, draft.scheme, draft.fields) };
}
