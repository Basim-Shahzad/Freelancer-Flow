/**
 * Domain model for Paylancr (Phase 1). All money is stored as INTEGER MINOR UNITS
 * (cents / paisa) to avoid float drift. Dates are ISO strings (YYYY-MM-DD) unless
 * the field name ends in `At` (full ISO timestamp).
 */

export type Currency = "USD" | "PKR" | "EUR" | "GBP" | "AED";
export const CURRENCIES: Currency[] = ["USD", "PKR", "EUR", "GBP", "AED"];

export type BillingType = "fixed" | "hourly" | "retainer" | "milestone";

export type InvoiceStatus = "draft" | "unpaid" | "partial" | "paid" | "overdue" | "written_off" | "void";

export type PaymentMethodKind =
  | "payoneer"
  | "esfca"
  | "elevate"
  | "wise"
  | "pkrbank"
  | "raast"
  | "jazzcash"
  | "easypaisa"
  | "bank"
  | "other";

export type BankScheme = "iban" | "ach" | "uk" | "swift";

export interface Client {
  id: string;
  name: string;
  contactName: string;
  email: string;
  /** E.164-ish, digits and leading +. Used to build wa.me links. */
  whatsapp: string;
  city: string;
  country: string;
  currency: Currency;
  /** Payment terms in days (0 = due on receipt). */
  termsDays: number;
  /** Methods this client usually pays by (tags only). */
  prefersMethods: PaymentMethodKind[];
  notes: string;
  createdAt: string;
}

export type MilestoneStatus = "upcoming" | "awaiting_approval" | "approved" | "changes_requested";

export interface Milestone {
  id: string;
  title: string;
  description: string;
  amount: number;
  dueDate: string;
  status: MilestoneStatus;
  approvedAt?: string;
  /** Client comment left when requesting changes. */
  comment?: string;
  invoiceId?: string;
}

export interface RetainerPeriod {
  id: string;
  label: string;
  start: string;
  end: string;
  amount: number;
  invoiceId?: string;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  billingType: BillingType;
  currency: Currency;
  status: "active" | "paused" | "completed";
  startDate: string;
  /** hourly: minor units per hour */
  hourlyRate?: number;
  /** fixed: total price */
  fixedAmount?: number;
  /** retainer */
  retainerAmount?: number;
  retainerHours?: number;
  /** Optional progress percent for fixed / hourly projects (0-100). */
  progress?: number;
  milestones: Milestone[];
  retainerPeriods: RetainerPeriod[];
  /** Public share token for the client portal (/p/[token]). */
  shareToken: string;
  notes: string;
}

export interface TimeEntry {
  id: string;
  projectId?: string;
  description: string;
  date: string;
  /** Local start time "HH:MM" on `date`. Optional: older entries only have date + minutes. */
  startTime?: string;
  minutes: number;
  billable: boolean;
  invoiceId?: string;
  /** Created or edited while offline and not yet synced. */
  unsynced?: boolean;
  updatedAt: string;
}

export interface InvoiceLine {
  id: string;
  description: string;
  /** Quantity as a decimal (hours, units). */
  qty: number;
  /** Rate in minor units. */
  rate: number;
  source?: { type: "time" | "milestone" | "retainer" | "manual"; refId?: string };
}

export interface Payment {
  id: string;
  amount: number;
  date: string;
  method: string;
  reference: string;
  recordedAt: string;
}

export type InvoiceEventType =
  | "created"
  | "sent"
  | "viewed"
  | "reminder"
  | "payment"
  | "payment_reversed"
  | "paid"
  | "overdue"
  | "written_off"
  | "write_off_reversed"
  | "void"
  | "edited";

export interface InvoiceEvent {
  id: string;
  type: InvoiceEventType;
  at: string;
  label: string;
}

export interface Invoice {
  id: string;
  number: string;
  clientId: string;
  projectId?: string;
  currency: Currency;
  /** Stored status. `overdue` and `partial` are derived at read time via deriveStatus(). */
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  lines: InvoiceLine[];
  taxPercent: number;
  /** Flat discount in minor units. */
  discount: number;
  paymentMethodIds: string[];
  note: string;
  shareToken: string;
  payments: Payment[];
  events: InvoiceEvent[];
  writtenOffAt?: string;
}

export interface PaymentMethod {
  id: string;
  kind: PaymentMethodKind;
  /** Custom label (required for "other"). */
  label?: string;
  scheme?: BankScheme;
  enabled: boolean;
  isDefault: boolean;
  fields: Record<string, string>;
}

export type ActivityType = "invoice" | "payment" | "project" | "client" | "time" | "settings";

export interface ActivityEntry {
  id: string;
  at: string;
  type: ActivityType;
  action: string;
  record: string;
  detail: string;
}

export interface BusinessProfile {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  taxId: string;
  address: string;
  defaultCurrency: Currency;
  defaultTermsDays: number;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  footerNote: string;
  logoName?: string;
  /** Your own hourly rate (the "floor"), integer minor units in defaultCurrency. */
  hourlyRate?: number;
}

export interface TimerState {
  running: boolean;
  projectId?: string;
  description: string;
  startedAt?: string;
}

/** Local-only app state. Identity (user, tokens) lives in `lib/store/auth.ts`. */
export interface Session {
  onboarded: boolean;
}

export interface DataExport {
  id: string;
  requestedAt: string;
  status: "preparing" | "ready" | "expired";
  fileName: string;
  sizeLabel: string;
}
