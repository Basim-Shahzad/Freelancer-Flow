/**
 * Domain model for Paylancr (Phase 1). All money is stored as INTEGER MINOR UNITS
 * (cents / paisa) to avoid float drift. Dates are ISO strings (YYYY-MM-DD) unless
 * the field name ends in `At` (full ISO timestamp).
 */

import type { ApiInvoiceEventType, ApiPaymentMethod } from "./api/invoices.types";

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

/** `scheme` of a BANK_TRANSFER, as the API names it. */
export type BankScheme = "IBAN" | "ACH" | "UK_SORT_CODE" | "SWIFT_OTHER";

export interface ClientProjectRef {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * Client view model, mapped from the API in `lib/api/mappers/clients.ts`. The API has no contact name,
 * city/country or preferred payment methods, so the UI does not either.
 */
export interface Client {
  id: string;
  name: string;
  companyName: string;
  email: string;
  /** As returned by the server (E.164 once normalised). Used to build wa.me links. */
  whatsapp: string;
  phone: string;
  address: string;
  /** Masked to the last digits on list items, full on the detail view. */
  taxId: string;
  currency: Currency;
  /** Payment terms in days (0 = due on receipt). */
  termsDays: number;
  notes: string;
  createdAt: string;
  /** Embedded on list items only. */
  projects?: ClientProjectRef[];
}

export type ProjectStatus = "draft" | "active" | "paused" | "completed" | "archived" | "cancelled";

/** The server only accepts monthly and quarterly retainers. */
export type RetainerInterval = "monthly" | "quarterly";

export type MilestoneStatus = "pending" | "in_progress" | "submitted" | "approved" | "rejected";

/** Milestone view model, mapped from the API in `lib/api/mappers/milestones.ts`. */
export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description: string;
  /** Minor units in the project's currency; absent when the milestone carries no money. */
  amount?: number;
  /** ISO date (YYYY-MM-DD). */
  dueDate?: string;
  status: MilestoneStatus;
  approvalRequired: boolean;
  sortOrder: number;
  submittedAt?: string;
  approvedAt?: string;
}

/** One billing period of a retainer project (`GET /projects/{id}/retainer-periods`). */
export interface RetainerPeriod {
  /** The period start date; unique within a project. */
  id: string;
  label: string;
  start: string;
  end: string;
  /** The retainer amount in minor units. */
  amount: number;
  /** The live invoice billing this period; absent when unbilled. */
  invoiceId?: string;
}

/**
 * Project view model, mapped from the API in `lib/api/mappers/projects.ts`. The API has no share token, start date,
 * notes, included hours, deposit % or estimated hours, so the UI does not either. A FIXED project's price is `budget`.
 */
export interface Project {
  id: string;
  clientId: string;
  /** Nested client from the API. */
  client: { id: string; name: string };
  name: string;
  description: string;
  billingType: BillingType;
  currency: Currency;
  status: ProjectStatus;
  /** Minor units: the fixed price (FIXED) or the total budget (other types). */
  budget?: number;
  /** HOURLY: minor units per hour (falls back to the profile rate on the server when unset). */
  hourlyRate?: number;
  /** RETAINER: minor units billed every `retainerInterval`. */
  retainerAmount?: number;
  retainerInterval?: RetainerInterval;
  retainerStartDate?: string;
  retainerEndDate?: string;
  /** ISO date (YYYY-MM-DD). */
  dueDate?: string;
  /** Always true for MILESTONE projects; the milestone UI is hidden when false. */
  milestonesEnabled: boolean;
  totalTimeSpentMinutes: number;
  /** 0-100, computed by the server; null when it has nothing to base it on (render "—"). */
  progressPercent: number | null;
  createdAt: string;
  updatedAt: string;
}

/** A project with its milestones and (retainer) periods, for the logic that needs them. */
export type ProjectWithSchedule = Project & { milestones: Milestone[]; retainerPeriods: RetainerPeriod[] };

/**
 * The client-portal project (`/p/[token]`). The portal has no account, so it stays on this mock shape until
 * step 13 gives it a token-based API. Not related to the authenticated `Project`.
 */
export type PortalMilestoneStatus = "upcoming" | "awaiting_approval" | "approved" | "changes_requested";

export interface PortalMilestone {
  id: string;
  title: string;
  description: string;
  amount: number;
  dueDate: string;
  status: PortalMilestoneStatus;
  approvedAt?: string;
  /** Client comment left when requesting changes. */
  comment?: string;
  invoiceId?: string;
}

export interface PortalRetainerPeriod {
  id: string;
  label: string;
  start: string;
  end: string;
  amount: number;
  invoiceId?: string;
}

export interface PortalProject {
  id: string;
  clientId: string;
  name: string;
  billingType: BillingType;
  currency: Currency;
  status: "active" | "paused" | "completed";
  startDate: string;
  hourlyRate?: number;
  fixedAmount?: number;
  retainerAmount?: number;
  retainerHours?: number;
  progress?: number;
  milestones: PortalMilestone[];
  retainerPeriods: PortalRetainerPeriod[];
  shareToken: string;
  notes: string;
}

export interface TimeEntry {
  id: string;
  projectId?: string;
  milestoneId?: string;
  description: string;
  /** Local calendar day the entry starts on, "YYYY-MM-DD". */
  date: string;
  /** Local start time "HH:MM" on `date`. */
  startTime?: string;
  /** UTC ISO start / end. `endAt` is absent while the timer runs. */
  startAt?: string;
  endAt?: string;
  minutes: number;
  billable: boolean;
  /** Locked to an invoice. The API exposes no invoice id on an entry. */
  isInvoiced: boolean;
  /** Hourly rate snapshot, minor units in the project's currency. */
  hourlyRate?: number;
  /** Queued in the offline outbox and not yet accepted by the server. */
  unsynced?: boolean;
  /** The server flagged this entry as overlapping another one (non-blocking). */
  overlap?: boolean;
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

/** One line of a server invoice. `fromTime` lines are quantities of hours. */
export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  /** Minor units. */
  unitPrice: number;
  amount: number;
  fromTime: boolean;
}

/** A payment recorded against a server invoice. `method` may be a legacy value (CARD, CHEQUE, PAYPAL). */
export interface InvoicePayment {
  id: string;
  amount: number;
  /** ISO timestamp. */
  paidAt: string;
  method: ApiPaymentMethod;
  reference?: string;
}

export interface InvoiceTaxLine {
  name: string;
  /** Percent, as the server's decimal string. */
  rate: string;
  amount: number;
  isInclusive: boolean;
  isWithholding: boolean;
}

export interface InvoiceIssuer {
  name?: string;
  businessName?: string;
  address?: string;
  taxRegistrationNumber?: string;
  taxLabel?: string;
}

/**
 * Invoice view model, mapped from the API in `lib/api/mappers/invoices.ts`. Every total comes from the server
 * (never recomputed). `status` is the server's `displayStatus` mapped onto the existing chip statuses
 * (SENT -> unpaid, PARTIALLY_PAID -> partial, CANCELLED -> void).
 */
export interface InvoiceDetail {
  id: string;
  number: string;
  status: InvoiceStatus;
  currency: Currency;
  /** ISO dates (YYYY-MM-DD). */
  issueDate: string;
  dueDate: string;
  clientId: string;
  projectId: string;
  client: { id: string; name: string };
  project: { id: string; name: string };
  issuer: InvoiceIssuer;
  items: InvoiceItem[];
  payments: InvoicePayment[];
  /** The payment methods snapshotted onto the invoice, in display order. */
  methods: PaymentMethod[];
  /** Minor units. */
  subtotal: number;
  discountRate: string;
  discountAmount: number;
  taxes: InvoiceTaxLine[];
  taxNote?: string;
  taxAmount: number;
  withholdingAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  notes?: string;
  /** Free-text "additional note" shown beside the payment methods. */
  paymentInstructions?: string;
  paymentDisclaimer: string;
  sentAt?: string;
  viewedAt?: string;
  /** When the invoice became fully paid. */
  paymentAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** A list row: the list endpoint returns the same shape as the detail. */
export type InvoiceSummary = InvoiceDetail;

export interface InvoiceTimelineEvent {
  id: string;
  type: ApiInvoiceEventType;
  at: string;
  detail?: string;
}

/** The result of send / remind: the links to hand to the client, and whether the email went out. */
export interface InvoiceShare {
  portalUrl: string;
  pdfUrl: string;
  whatsappUrl: string;
  /** Null when no email was attempted. */
  emailDelivered: boolean | null;
  invoice: InvoiceDetail;
}

/**
 * The mock invoice (Phase 1 store). Still used by the create flow, dashboard, export and portal until steps 9-14
 * migrate them; the list and detail screens use `InvoiceDetail`.
 */
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

/**
 * Payment method view model, mapped from the API in `lib/api/mappers/payment-methods.ts`. `fields` is the API's
 * `details` object (camelCase keys, normalised by the server) minus `scheme`. It holds IBANs and wallet numbers:
 * keep it in react-query memory only, never log it or persist it.
 */
export interface PaymentMethod {
  id: string;
  kind: PaymentMethodKind;
  /** Name shown to the client; the server requires one. */
  label: string;
  scheme?: BankScheme;
  /** `isActive` on the wire: shown on invoices. */
  enabled: boolean;
  isDefault: boolean;
  sortOrder: number;
  currency?: string;
  fields: Record<string, string>;
  /** Payoneer payment-request link on an invoice snapshot: a link-out, never a charge. */
  payLink?: string;
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

/**
 * Business fields the profile API has no home for yet (no phone / footer note / logo upload, and
 * `invoiceNumberFormat` is not a prefix + counter). They stay in the local store, so they do NOT follow
 * the user across devices. Revisit once the backend models them (invoice numbering: steps 8-9).
 */
export type BusinessLocal = Pick<BusinessProfile, "phone" | "footerNote" | "invoicePrefix" | "nextInvoiceNumber" | "logoName">;

export interface DataExport {
  id: string;
  requestedAt: string;
  status: "preparing" | "ready" | "expired";
  fileName: string;
  sizeLabel: string;
}
