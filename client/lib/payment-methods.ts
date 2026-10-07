import type { BankScheme, PaymentMethod, PaymentMethodKind } from "./types";

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
}

export interface MethodKindInfo {
  kind: PaymentMethodKind;
  label: string;
  intro: string;
  /** Short line for lists ("who it's for"). */
  audience: string;
  fields: MethodField[];
}

const holder: MethodField = { key: "holder", label: "Account title", placeholder: "Ayesha Malik", required: true };

export const METHOD_KINDS: Record<PaymentMethodKind, MethodKindInfo> = {
  payoneer: {
    kind: "payoneer", label: "Payoneer",
    intro: "Clients pay through a Payoneer payment request or to your Payoneer email.",
    audience: "International clients and marketplaces",
    fields: [
      { key: "email", label: "Payoneer email", placeholder: "you@example.com", required: true },
      { key: "link", label: "Payment request link", placeholder: "https://payoneer.com/…", hint: "Optional. Clients get a button that opens it.", copy: false },
    ],
  },
  esfca: {
    kind: "esfca", label: "ESFCA wire (USD)",
    intro: "Foreign-currency wire to your Exporters' Special Foreign Currency Account.",
    audience: "USD wires to your foreign-currency account",
    fields: [
      holder,
      { key: "bank", label: "Bank", placeholder: "Standard Chartered Pakistan", required: true },
      { key: "iban", label: "IBAN", placeholder: "PK36 SCBL 0000 0011 2345 6702", sensitive: true, required: true },
      { key: "swift", label: "SWIFT / BIC", placeholder: "SCBLPKKX", required: true },
      { key: "purpose", label: "Purpose of payment", placeholder: "Export of IT services", hint: "Printed with the invoice number as the reference." },
    ],
  },
  elevate: {
    kind: "elevate", label: "Elevate Pay",
    intro: "Clients pay to your Elevate Pay account.",
    audience: "Clients paying through Elevate",
    fields: [{ key: "email", label: "Elevate Pay email", placeholder: "you@example.com", required: true }],
  },
  wise: {
    kind: "wise", label: "Wise (to IBAN)",
    intro: "Clients send from Wise to your IBAN.",
    audience: "Wise transfers to your IBAN",
    fields: [
      holder,
      { key: "iban", label: "IBAN", placeholder: "BE68 5390 0754 7034", sensitive: true, required: true },
      { key: "swift", label: "SWIFT / BIC", placeholder: "TRWIBEB1" },
    ],
  },
  pkrbank: {
    kind: "pkrbank", label: "PKR bank transfer",
    intro: "Local transfer to your Pakistani bank account in rupees.",
    audience: "Local clients, by IBAN",
    fields: [
      holder,
      { key: "bank", label: "Bank", placeholder: "HBL", required: true },
      { key: "iban", label: "IBAN", placeholder: "PK36 HABB 0000 0011 2345 6702", sensitive: true, required: true },
    ],
  },
  raast: {
    kind: "raast", label: "Raast",
    intro: "Instant local transfer using your Raast ID.",
    audience: "Instant local transfers by Raast ID",
    fields: [
      { key: "raastId", label: "Raast ID", placeholder: "0300 5550214", sensitive: true, required: true },
      holder,
    ],
  },
  jazzcash: {
    kind: "jazzcash", label: "JazzCash",
    intro: "Wallet payment to your JazzCash number.",
    audience: "Wallet payments",
    fields: [{ key: "wallet", label: "Wallet number", placeholder: "0300 5550214", sensitive: true, required: true }, holder],
  },
  easypaisa: {
    kind: "easypaisa", label: "Easypaisa",
    intro: "Wallet payment to your Easypaisa number.",
    audience: "Wallet payments",
    fields: [{ key: "wallet", label: "Wallet number", placeholder: "0321 5550214", sensitive: true, required: true }, holder],
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
    fields: [
      { key: "title", label: "Method name", placeholder: "Cash pickup", required: true },
      { key: "instructions", label: "Instructions", placeholder: "Step-by-step details for your client", multiline: true, required: true },
    ],
  },
};

export const BANK_SCHEMES: Record<BankScheme, { label: string; fields: MethodField[] }> = {
  iban: { label: "IBAN", fields: [holder, { key: "bank", label: "Bank" }, { key: "iban", label: "IBAN", sensitive: true, required: true }, { key: "swift", label: "SWIFT / BIC" }] },
  ach: { label: "US ACH", fields: [holder, { key: "bank", label: "Bank" }, { key: "routing", label: "Routing number", sensitive: true, required: true }, { key: "account", label: "Account number", sensitive: true, required: true }, { key: "accountType", label: "Account type", placeholder: "Checking" }] },
  uk: { label: "UK sort code", fields: [holder, { key: "sortCode", label: "Sort code", placeholder: "23-14-70", sensitive: true, required: true }, { key: "account", label: "Account number", sensitive: true, required: true }] },
  swift: { label: "SWIFT", fields: [holder, { key: "bank", label: "Bank", required: true }, { key: "account", label: "Account number", sensitive: true, required: true }, { key: "swift", label: "SWIFT / BIC", required: true }, { key: "address", label: "Bank address", multiline: true }] },
};

export function fieldsFor(kind: PaymentMethodKind, scheme: BankScheme = "iban"): MethodField[] {
  return kind === "bank" ? BANK_SCHEMES[scheme].fields : METHOD_KINDS[kind].fields;
}

export function methodTitle(m: Pick<PaymentMethod, "kind" | "label" | "fields" | "scheme">): string {
  if (m.kind === "other") return m.fields.title || m.label || "Other";
  if (m.kind === "bank") return `Bank transfer · ${BANK_SCHEMES[m.scheme ?? "iban"].label}`;
  return METHOD_KINDS[m.kind].label;
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
export function methodSummary(m: PaymentMethod): string {
  const f = m.fields;
  const tail = (v?: string) => (v ? v.replace(/\s/g, "").slice(-4) : "");
  switch (m.kind) {
    case "payoneer": case "elevate": return f.email ?? "";
    case "esfca": case "pkrbank": return [f.bank, f.iban && `IBAN ending ${tail(f.iban)}`].filter(Boolean).join(" · ");
    case "wise": return f.iban ? `IBAN ending ${tail(f.iban)}` : "";
    case "raast": return f.raastId ? `Raast ID ending ${tail(f.raastId)}` : "";
    case "jazzcash": case "easypaisa": return f.wallet ? `Wallet ending ${tail(f.wallet)}` : "";
    case "bank": return [f.bank, (f.iban ?? f.account ?? f.sortCode) && `ending ${tail(f.iban ?? f.account ?? f.sortCode)}`].filter(Boolean).join(" · ");
    default: return f.instructions?.slice(0, 48) ?? "";
  }
}
