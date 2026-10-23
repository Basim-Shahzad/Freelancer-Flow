import type { BankScheme, PaymentMethod, PaymentMethodKind } from "./types";

/**
 * Field keys are the API's `details` keys (camelCase). The server validates and normalises them, so the form only
 * does light checks; see `server/app/schemas/PaymentMethodSchema.py`.
 */
export interface MethodField {
  key: string;
  label: string;
  placeholder?: string;
  hint?: string;
  /** Show only the last 4 characters in previews and PDFs. */
  sensitive?: boolean;
  multiline?: boolean;
  /** Offer a copy button to clients. Defaults to true. */
  copy?: boolean;
  required?: boolean;
  /** Fixed choices, rendered as a select. */
  options?: { value: string; label: string }[];
}

export interface MethodKindInfo {
  kind: PaymentMethodKind;
  label: string;
  intro: string;
  /** Short line for lists ("who it's for"). */
  audience: string;
  fields: MethodField[];
  /** At least one of these keys must be filled (the server's "X and/or Y" rule). */
  requireOneOf?: string[];
}

const ACCOUNT_TYPES = [{ value: "CHECKING", label: "Checking" }, { value: "SAVINGS", label: "Savings" }];

const title: MethodField = { key: "accountTitle", label: "Account title", placeholder: "Ayesha Malik", required: true };

export const METHOD_KINDS: Record<PaymentMethodKind, MethodKindInfo> = {
  payoneer: {
    kind: "payoneer", label: "Payoneer",
    intro: "Clients pay through a Payoneer payment request or to your Payoneer email.",
    audience: "International clients and marketplaces",
    requireOneOf: ["accountEmail", "paymentRequestUrl"],
    fields: [
      { key: "accountEmail", label: "Payoneer email", placeholder: "you@example.com" },
      { key: "paymentRequestUrl", label: "Payment request link", placeholder: "https://payoneer.com/…", hint: "Use the email, the link, or both. Clients get a button that opens the link.", copy: false },
      { key: "accountHolder", label: "Receiving account holder", hint: "Optional receiving bank details." },
      { key: "bankName", label: "Receiving bank" },
      { key: "iban", label: "Receiving IBAN", sensitive: true },
      { key: "swiftBic", label: "Receiving SWIFT / BIC" },
    ],
  },
  esfca: {
    kind: "esfca", label: "ESFCA wire (USD)",
    intro: "Foreign-currency wire to your Exporters' Special Foreign Currency Account.",
    audience: "USD wires to your foreign-currency account",
    fields: [
      { key: "beneficiaryName", label: "Beneficiary name", placeholder: "Ayesha Malik", required: true },
      { key: "bankName", label: "Bank", placeholder: "Standard Chartered Pakistan", required: true },
      { key: "iban", label: "IBAN", placeholder: "PK36 SCBL 0000 0011 2345 6702", sensitive: true, required: true },
      { key: "swiftBic", label: "SWIFT / BIC", placeholder: "SCBLPKKX", required: true },
      { key: "bankAddress", label: "Bank address", multiline: true, required: true },
      { key: "purposeOfPayment", label: "Purpose of payment", placeholder: "Export of IT services", hint: "Leave empty to use the default wording. Printed with the invoice number as the reference." },
    ],
  },
  elevate: {
    kind: "elevate", label: "Elevate Pay",
    intro: "Clients pay to your Elevate Pay account.",
    audience: "Clients paying through Elevate",
    fields: [
      { key: "accountHolder", label: "Account holder", placeholder: "Ayesha Malik", required: true },
      { key: "accountNumber", label: "Account number", sensitive: true, required: true },
      { key: "routingNumber", label: "Routing number", sensitive: true, required: true },
      { key: "bankName", label: "Bank", required: true },
      { key: "accountType", label: "Account type", options: ACCOUNT_TYPES, required: true },
    ],
  },
  wise: {
    kind: "wise", label: "Wise (to IBAN)",
    intro: "Clients send from Wise to your IBAN.",
    audience: "Wise transfers to your IBAN",
    fields: [
      { key: "beneficiaryName", label: "Beneficiary name", placeholder: "Ayesha Malik", required: true },
      { key: "iban", label: "IBAN", placeholder: "BE68 5390 0754 7034", sensitive: true, required: true },
      { key: "bankName", label: "Bank", placeholder: "Wise", required: true },
      { key: "note", label: "Note for your client", multiline: true },
    ],
  },
  pkrbank: {
    kind: "pkrbank", label: "PKR bank transfer",
    intro: "Local transfer to your Pakistani bank account in rupees.",
    audience: "Local clients, by IBAN",
    fields: [
      title,
      { key: "bankName", label: "Bank", placeholder: "HBL", required: true },
      { key: "iban", label: "IBAN", placeholder: "PK36 HABB 0000 0011 2345 6702", sensitive: true, required: true },
      { key: "accountNumber", label: "Account number", sensitive: true },
    ],
  },
  raast: {
    kind: "raast", label: "Raast",
    intro: "Instant local transfer using your Raast ID or IBAN.",
    audience: "Instant local transfers by Raast ID",
    requireOneOf: ["raastId", "iban"],
    fields: [
      { key: "raastId", label: "Raast ID", placeholder: "0300 5550214", sensitive: true },
      { key: "iban", label: "IBAN", placeholder: "PK36 HABB 0000 0011 2345 6702", sensitive: true, hint: "Use the Raast ID, the IBAN, or both." },
      title,
    ],
  },
  jazzcash: {
    kind: "jazzcash", label: "JazzCash",
    intro: "Wallet payment to your JazzCash number.",
    audience: "Wallet payments",
    fields: [{ key: "mobileNumber", label: "Wallet number", placeholder: "0300 5550214", sensitive: true, required: true }, title],
  },
  easypaisa: {
    kind: "easypaisa", label: "Easypaisa",
    intro: "Wallet payment to your Easypaisa number.",
    audience: "Wallet payments",
    fields: [{ key: "mobileNumber", label: "Wallet number", placeholder: "0321 5550214", sensitive: true, required: true }, title],
  },
  bank: {
    kind: "bank", label: "Bank transfer",
    intro: "Choose the account scheme your client's bank uses.",
    audience: "IBAN, US ACH, UK sort code or SWIFT",
    fields: [],
  },
  other: {
    kind: "other", label: "Other",
    intro: "Anything else: describe how to pay you.",
    audience: "Custom instructions",
    fields: [{ key: "instructions", label: "Instructions", placeholder: "Step-by-step details for your client", multiline: true, required: true }],
  },
};

/** Fields every BANK_TRANSFER has, whatever its scheme. */
export const BANK_COMMON_FIELDS: MethodField[] = [
  { key: "accountHolder", label: "Account holder", placeholder: "Ayesha Malik", required: true },
  { key: "bankName", label: "Bank", required: true },
  { key: "country", label: "Country", placeholder: "US", hint: "Two-letter code, e.g. US, GB, DE.", copy: false, required: true },
  { key: "currency", label: "Currency", placeholder: "USD", hint: "Three-letter code.", copy: false, required: true },
  { key: "bankAddress", label: "Bank address", multiline: true },
  { key: "referenceNote", label: "Reference note", hint: "Shown to clients, e.g. what to put as the payment reference." },
];

/** Scheme-specific fields. Adding a scheme = one entry here (plus the server's `BANK_SCHEMES`) and one in `BANK_SCHEME_ORDER`. */
export const BANK_SCHEMES: Record<BankScheme, { label: string; fields: MethodField[] }> = {
  IBAN: {
    label: "IBAN",
    fields: [{ key: "iban", label: "IBAN", sensitive: true, required: true }, { key: "swiftBic", label: "SWIFT / BIC" }],
  },
  ACH: {
    label: "US ACH",
    fields: [
      { key: "routingNumber", label: "Routing number", sensitive: true, required: true },
      { key: "accountNumber", label: "Account number", sensitive: true, required: true },
      { key: "accountType", label: "Account type", options: ACCOUNT_TYPES, required: true },
    ],
  },
  UK_SORT_CODE: {
    label: "UK sort code",
    fields: [
      { key: "sortCode", label: "Sort code", placeholder: "23-14-70", sensitive: true, required: true },
      { key: "accountNumber", label: "Account number", sensitive: true, required: true },
    ],
  },
  SWIFT_OTHER: {
    label: "SWIFT",
    fields: [
      { key: "accountNumber", label: "Account number", sensitive: true, required: true },
      { key: "swiftBic", label: "SWIFT / BIC", required: true },
      { key: "branchCode", label: "Branch code" },
    ],
  },
};

export const BANK_SCHEME_ORDER: BankScheme[] = ["IBAN", "ACH", "UK_SORT_CODE", "SWIFT_OTHER"];

export const DEFAULT_BANK_SCHEME: BankScheme = "IBAN";

export function fieldsFor(kind: PaymentMethodKind, scheme: BankScheme = DEFAULT_BANK_SCHEME): MethodField[] {
  return kind === "bank" ? [...BANK_COMMON_FIELDS, ...BANK_SCHEMES[scheme].fields] : METHOD_KINDS[kind].fields;
}

/** The label a method gets when its owner leaves it blank (and the form's starting value). */
export function defaultLabel(kind: PaymentMethodKind, scheme?: BankScheme): string {
  return kind === "bank" ? `Bank transfer · ${BANK_SCHEMES[scheme ?? DEFAULT_BANK_SCHEME].label}` : METHOD_KINDS[kind].label;
}

export function methodTitle(m: Pick<PaymentMethod, "kind" | "label" | "scheme">): string {
  return m.label.trim() || defaultLabel(m.kind, m.scheme);
}

/** Last 4 characters visible: "PK36 SCBL •••• •••• •••• 6702". */
export function maskValue(v: string): string {
  const compact = v.replace(/\s/g, "");
  if (compact.length <= 4) return "••••";
  const tail = compact.slice(-4);
  const head = v.trim().slice(0, 4);
  return `${head} •••• ${tail}`;
}

/** Short one-line summary for lists ("HBL · IBAN ending 6702"). */
export function methodSummary(m: Pick<PaymentMethod, "kind" | "fields">): string {
  const f = m.fields;
  const tail = (v?: string) => (v ? v.replace(/\s/g, "").slice(-4) : "");
  switch (m.kind) {
    case "payoneer": return f.accountEmail ?? f.paymentRequestUrl ?? "";
    case "elevate": return [f.bankName, f.accountNumber && `account ending ${tail(f.accountNumber)}`].filter(Boolean).join(" · ");
    case "esfca": case "pkrbank": return [f.bankName, f.iban && `IBAN ending ${tail(f.iban)}`].filter(Boolean).join(" · ");
    case "wise": return f.iban ? `IBAN ending ${tail(f.iban)}` : "";
    case "raast": return f.raastId ? `Raast ID ending ${tail(f.raastId)}` : f.iban ? `IBAN ending ${tail(f.iban)}` : "";
    case "jazzcash": case "easypaisa": return f.mobileNumber ? `Wallet ending ${tail(f.mobileNumber)}` : "";
    case "bank": {
      const id = f.iban ?? f.accountNumber ?? f.sortCode;
      return [f.bankName, id && `ending ${tail(id)}`].filter(Boolean).join(" · ");
    }
    default: return f.instructions?.slice(0, 48) ?? "";
  }
}
