import { daysFromToday as d } from "./dates";
import type {
  ActivityEntry, BusinessProfile, Client, DataExport, Invoice, PaymentMethod, Project, TimeEntry,
} from "./types";

/**
 * Demo data. Dates are relative to "today" so statuses (overdue, due soon) always read
 * correctly. Replace with API data; shapes match lib/types.ts.
 */
const ts = (days: number, hm = "10:00") => `${d(days)}T${hm}:00.000Z`;
const ev = (id: string, type: Invoice["events"][number]["type"], days: number, label: string, hm = "10:00") => ({ id, type, at: ts(days, hm), label });

export const seedBusiness: BusinessProfile = {
  businessName: "Malik Studio", ownerName: "Ayesha Malik", email: "ayesha@maliks.studio", phone: "+92 300 5550214",
  taxId: "1234567-8", address: "Gulberg III, Lahore, Pakistan", defaultCurrency: "USD", defaultTermsDays: 14,
  invoicePrefix: "INV-", nextInvoiceNumber: 46, footerNote: "Thank you for your business.", hourlyRate: 4000,
};

export const seedClients: Client[] = [
  { id: "c-harbor", name: "Harbor Labs", contactName: "Jordan Reyes", email: "jordan@harborlabs.example", whatsapp: "+1 512 555 0142", city: "Austin", country: "US", currency: "USD", termsDays: 14, prefersMethods: ["payoneer", "esfca"], notes: "Prefers invoices on Mondays.", createdAt: ts(-120) },
  { id: "c-gulberg", name: "Gulberg Textiles", contactName: "Hamza Qureshi", email: "hamza@gulbergtextiles.example", whatsapp: "+92 321 5550188", city: "Lahore", country: "PK", currency: "PKR", termsDays: 14, prefersMethods: ["pkrbank", "raast"], notes: "", createdAt: ts(-90) },
  { id: "c-alnoor", name: "Al Noor Trading", contactName: "Sara Al Mansoori", email: "sara@alnoor.example", whatsapp: "+971 50 555 0117", city: "Dubai", country: "AE", currency: "USD", termsDays: 7, prefersMethods: ["payoneer"], notes: "Monthly retainer, invoice on the 1st.", createdAt: ts(-75) },
  { id: "c-dua", name: "Dua Studio", contactName: "Dua Fatima", email: "dua@duastudio.example", whatsapp: "+92 333 5550166", city: "Karachi", country: "PK", currency: "PKR", termsDays: 7, prefersMethods: ["raast", "jazzcash"], notes: "", createdAt: ts(-60) },
  { id: "c-kareem", name: "Kareem & Co.", contactName: "Imran Kareem", email: "imran@kareem.example", whatsapp: "+971 55 555 0129", city: "Dubai", country: "AE", currency: "USD", termsDays: 14, prefersMethods: ["esfca"], notes: "", createdAt: ts(-200) },
];

export const seedProjects: Project[] = [
  {
    id: "p-harbor", clientId: "c-harbor", name: "Mobile app", billingType: "hourly", currency: "USD", status: "active",
    startDate: d(-110), hourlyRate: 4500, progress: 60, milestones: [], retainerPeriods: [], shareToken: "harbor-mobile-7Kq2", notes: "Checkout, onboarding and settings.",
  },
  {
    id: "p-gulberg", clientId: "c-gulberg", name: "Brand site", billingType: "milestone", currency: "PKR", status: "active",
    startDate: d(-80), notes: "Marketing site for the new textile line.", shareToken: "gulberg-brand-9Xr4", retainerPeriods: [],
    milestones: [
      { id: "m-1", title: "Brand discovery", description: "Workshops, moodboards and a brand direction.", amount: 18500000, dueDate: d(-32), status: "approved", approvedAt: ts(-37), invoiceId: "inv-39" },
      { id: "m-2", title: "Design approved", description: "Final homepage and inner-page designs for desktop and mobile, with the brand guide.", amount: 8500000, dueDate: d(7), status: "awaiting_approval" },
      { id: "m-3", title: "Build handover", description: "Production build, CMS handover and a walkthrough.", amount: 10000000, dueDate: d(35), status: "upcoming" },
    ],
  },
  {
    id: "p-alnoor", clientId: "c-alnoor", name: "Retainer", billingType: "retainer", currency: "USD", status: "active",
    startDate: d(-65), retainerAmount: 130000, retainerHours: 12, notes: "12 hours a month of design support.", shareToken: "alnoor-retainer-3Mt8", milestones: [],
    retainerPeriods: [
      { id: "rp-aug", label: "Aug 2026", start: "2026-08-01", end: "2026-08-31", amount: 130000, invoiceId: "inv-35" },
      { id: "rp-sep", label: "Sep 2026", start: "2026-09-01", end: "2026-09-30", amount: 130000, invoiceId: "inv-43" },
      { id: "rp-oct", label: "Oct 2026", start: "2026-10-01", end: "2026-10-31", amount: 130000, invoiceId: "inv-45" },
    ],
  },
  {
    id: "p-dua", clientId: "c-dua", name: "Logo refresh", billingType: "fixed", currency: "PKR", status: "active",
    startDate: d(-40), fixedAmount: 18000000, progress: 75, notes: "Logo, palette and a one-page guideline.", shareToken: "dua-logo-5Hn1", milestones: [], retainerPeriods: [],
  },
  {
    id: "p-kareem", clientId: "c-kareem", name: "Pitch deck", billingType: "fixed", currency: "USD", status: "completed",
    startDate: d(-150), fixedAmount: 240000, progress: 100, notes: "", shareToken: "kareem-deck-2Wd6", milestones: [], retainerPeriods: [],
  },
];

const line = (id: string, description: string, qty: number, rate: number, type: "time" | "milestone" | "retainer" | "manual", refId?: string) => ({ id, description, qty, rate, source: { type, refId } });

export const seedInvoices: Invoice[] = [
  {
    id: "inv-45", number: "INV-0045", clientId: "c-alnoor", projectId: "p-alnoor", currency: "USD", status: "draft",
    issueDate: d(0), dueDate: d(7), lines: [line("l45a", "Retainer · Oct 2026", 1, 130000, "retainer", "rp-oct")],
    taxPercent: 0, discount: 0, paymentMethodIds: ["pm-payoneer"], note: "", shareToken: "inv45-Qp0Z", payments: [],
    events: [ev("e45a", "created", 0, "Draft created", "09:05")],
  },
  {
    id: "inv-44", number: "INV-0044", clientId: "c-dua", projectId: "p-dua", currency: "PKR", status: "unpaid",
    issueDate: d(-6), dueDate: d(1), lines: [line("l44a", "Logo refresh · design delivery", 1, 9000000, "manual")],
    taxPercent: 0, discount: 0, paymentMethodIds: ["pm-pkrbank", "pm-raast"], note: "", shareToken: "inv44-Lm3V",
    payments: [{ id: "pay44a", amount: 3000000, date: d(-1), method: "Raast", reference: "RA-4410", recordedAt: ts(-1, "16:31") }],
    events: [ev("e44a", "created", -6, "Invoice created"), ev("e44b", "sent", -6, "Sent on WhatsApp", "10:20"), ev("e44c", "viewed", -5, "Viewed by client", "11:02"), ev("e44d", "payment", -1, "Payment recorded · PKR 30,000", "16:31")],
  },
  {
    id: "inv-43", number: "INV-0043", clientId: "c-alnoor", projectId: "p-alnoor", currency: "USD", status: "unpaid",
    issueDate: d(-5), dueDate: d(2), lines: [line("l43a", "Retainer · Sep 2026", 1, 130000, "retainer", "rp-sep")],
    taxPercent: 0, discount: 0, paymentMethodIds: ["pm-payoneer"], note: "", shareToken: "inv43-Rt5N", payments: [],
    events: [ev("e43a", "created", -5, "Invoice created"), ev("e43b", "sent", -5, "Sent by email to sara@alnoor.example", "10:20")],
  },
  {
    id: "inv-42", number: "INV-0042", clientId: "c-harbor", projectId: "p-harbor", currency: "USD", status: "unpaid",
    issueDate: d(-2), dueDate: d(12), lines: [line("l42a", "Mobile app QA · 28 Sep – 02 Oct", 25, 4500, "manual"), line("l42b", "Sprint planning workshop", 1, 12500, "manual")],
    taxPercent: 0, discount: 0, paymentMethodIds: ["pm-payoneer", "pm-esfca"], note: "", shareToken: "inv42-k3x9q2", payments: [],
    events: [ev("e42a", "created", -2, "Invoice created", "10:14"), ev("e42b", "sent", -2, "Sent by email to jordan@harborlabs.example", "10:20"), ev("e42c", "viewed", -2, "Viewed by client", "11:02")],
  },
  {
    id: "inv-41", number: "INV-0041", clientId: "c-harbor", projectId: "p-harbor", currency: "USD", status: "unpaid",
    issueDate: d(-32), dueDate: d(-18), lines: [line("l41a", "Mobile app · Sep sprint", 44, 4500, "manual")],
    taxPercent: 0, discount: 0, paymentMethodIds: ["pm-payoneer", "pm-esfca"], note: "", shareToken: "inv41-Vb8D",
    payments: [{ id: "pay41a", amount: 198000, date: d(-10), method: "ESFCA wire", reference: "SCB-220914", recordedAt: ts(-10, "08:20") }],
    events: [ev("e41a", "created", -32, "Invoice created"), ev("e41b", "sent", -32, "Sent by email"), ev("e41c", "payment", -10, "Payment recorded · USD 1,980.00", "08:20"), ev("e41d", "paid", -10, "Marked paid", "08:20")],
  },
  {
    id: "inv-40", number: "INV-0040", clientId: "c-kareem", projectId: "p-kareem", currency: "USD", status: "unpaid",
    issueDate: d(-50), dueDate: d(-36), lines: [line("l40a", "Pitch deck · final delivery", 1, 240000, "manual")],
    taxPercent: 0, discount: 0, paymentMethodIds: ["pm-esfca"], note: "", shareToken: "inv40-Kd2F",
    payments: [{ id: "pay40a", amount: 240000, date: d(-40), method: "ESFCA wire", reference: "SCB-218877", recordedAt: ts(-40) }],
    events: [ev("e40a", "created", -50, "Invoice created"), ev("e40b", "sent", -50, "Sent by email"), ev("e40c", "payment", -40, "Payment recorded · USD 2,400.00"), ev("e40d", "paid", -40, "Marked paid")],
  },
  {
    id: "inv-39", number: "INV-0039", clientId: "c-gulberg", projectId: "p-gulberg", currency: "PKR", status: "unpaid",
    issueDate: d(-29), dueDate: d(-15), lines: [line("l39a", "Brand discovery milestone", 1, 18500000, "milestone", "m-1")],
    taxPercent: 0, discount: 0, paymentMethodIds: ["pm-pkrbank", "pm-raast"], note: "", shareToken: "inv39-Gh7S", payments: [],
    events: [ev("e39a", "created", -29, "Invoice created"), ev("e39b", "sent", -29, "Sent by email", "12:05"), ev("e39c", "viewed", -28, "Viewed by client", "08:47"), ev("e39d", "reminder", -10, "Reminder sent by email (polite)", "09:00"), ev("e39e", "overdue", -14, "Marked overdue automatically", "00:00")],
  },
  {
    id: "inv-38", number: "INV-0038", clientId: "c-dua", projectId: "p-dua", currency: "PKR", status: "unpaid",
    issueDate: d(-38), dueDate: d(-31), lines: [line("l38a", "Logo refresh · 40% deposit", 1, 6000000, "manual")],
    taxPercent: 0, discount: 0, paymentMethodIds: ["pm-pkrbank", "pm-raast"], note: "", shareToken: "inv38-Ac4B",
    payments: [{ id: "pay38a", amount: 6000000, date: d(-33), method: "Raast", reference: "RA-3920", recordedAt: ts(-33) }],
    events: [ev("e38a", "created", -38, "Invoice created"), ev("e38b", "sent", -38, "Sent on WhatsApp"), ev("e38c", "payment", -33, "Payment recorded · PKR 60,000"), ev("e38d", "paid", -33, "Marked paid")],
  },
  {
    id: "inv-36", number: "INV-0036", clientId: "c-kareem", currency: "USD", status: "written_off",
    issueDate: d(-52), dueDate: d(-38), lines: [line("l36a", "Logo variants", 1, 40000, "manual")],
    taxPercent: 0, discount: 0, paymentMethodIds: ["pm-esfca"], note: "", shareToken: "inv36-Ew9J", payments: [], writtenOffAt: ts(-7, "17:30"),
    events: [ev("e36a", "created", -52, "Invoice created"), ev("e36b", "sent", -52, "Sent by email"), ev("e36c", "reminder", -9, "Reminder sent on WhatsApp (final)", "17:30"), ev("e36d", "written_off", -7, "Written off · USD 400.00 · reason: client closed", "17:30")],
  },
  {
    id: "inv-35", number: "INV-0035", clientId: "c-alnoor", projectId: "p-alnoor", currency: "USD", status: "unpaid",
    issueDate: d(-36), dueDate: d(-29), lines: [line("l35a", "Retainer · Aug 2026", 1, 130000, "retainer", "rp-aug")],
    taxPercent: 0, discount: 0, paymentMethodIds: ["pm-payoneer"], note: "", shareToken: "inv35-Pn1M",
    payments: [{ id: "pay35a", amount: 130000, date: d(-30), method: "Payoneer", reference: "PAYO-77120", recordedAt: ts(-30) }],
    events: [ev("e35a", "created", -36, "Invoice created"), ev("e35b", "sent", -36, "Sent by email"), ev("e35c", "payment", -30, "Payment recorded · USD 1,300.00"), ev("e35d", "paid", -30, "Marked paid")],
  },
];

const te = (id: string, projectId: string | undefined, description: string, days: number, hours: number, startTime: string, billable = true, invoiceId?: string): TimeEntry => ({
  id, projectId, description, date: d(days), startTime, minutes: Math.round(hours * 60), billable, invoiceId, updatedAt: ts(days, "18:00"),
});

export const seedTime: TimeEntry[] = [
  te("t-1", "p-alnoor", "Retainer check-in call", 0, 0.75, "08:30"),
  te("t-2", "p-harbor", "Push notification spike", -1, 5, "09:00"),
  te("t-3", "p-harbor", "Onboarding screens QA", -3, 3.5, "09:00"),
  te("t-4", "p-gulberg", "Homepage hero comps", -3, 2.5, "13:30"),
  te("t-5", "p-harbor", "Settings screen build", -4, 4, "09:00"),
  te("t-6", undefined, "Admin and bookkeeping", -4, 1, "14:00", false),
  te("t-7", "p-harbor", "Prototype review", -7, 7.5, "09:30"),
  te("t-8", "p-harbor", "Navigation rework", -6, 6, "10:00"),
  te("t-9", "p-harbor", "Settings screen build", -5, 5.5, "09:00"),
  te("t-10", "p-harbor", "Release candidate testing", -10, 6, "10:30", true, "inv-41"),
];

export const seedMethods: PaymentMethod[] = [
  { id: "pm-payoneer", kind: "payoneer", enabled: true, isDefault: true, fields: { email: "ayesha@maliks.studio", link: "https://payoneer.com/pay/malik-studio" } },
  { id: "pm-esfca", kind: "esfca", enabled: true, isDefault: false, fields: { holder: "Ayesha Malik", bank: "Standard Chartered Pakistan", iban: "PK36 SCBL 0000 0011 2345 6702", swift: "SCBLPKKX", purpose: "Export of IT services" } },
  { id: "pm-pkrbank", kind: "pkrbank", enabled: true, isDefault: false, fields: { holder: "Ayesha Malik", bank: "HBL", iban: "PK36 HABB 0000 0011 2345 6702" } },
  { id: "pm-raast", kind: "raast", enabled: true, isDefault: false, fields: { raastId: "0300 5550214", holder: "Ayesha Malik" } },
  { id: "pm-jazzcash", kind: "jazzcash", enabled: false, isDefault: false, fields: { wallet: "0300 5550214", holder: "Ayesha Malik" } },
];

const act = (id: string, days: number, hm: string, type: ActivityEntry["type"], action: string, record: string, detail: string): ActivityEntry => ({ id, at: ts(days, hm), type, action, record, detail });

export const seedActivity: ActivityEntry[] = [
  act("a1", -1, "16:31", "payment", "Payment recorded", "INV-0044", "PKR 30,000 · Raast · ref RA-4410"),
  act("a2", -2, "10:20", "invoice", "Invoice sent by email", "INV-0042", "To jordan@harborlabs.example"),
  act("a3", -2, "10:14", "invoice", "Invoice created", "INV-0042", "25 h + 1 manual line · USD 1,250.00"),
  act("a4", -3, "18:40", "project", "Milestone ready for approval", "Brand site", "“Design approved” shared via link"),
  act("a5", -5, "12:02", "settings", "Payment method reordered", "Settings", "ESFCA wire moved above PKR bank transfer"),
  act("a6", -7, "17:30", "invoice", "Written off", "INV-0036", "USD 400.00 · reason: client closed"),
  act("a7", -10, "08:20", "invoice", "Status changed to paid", "INV-0041", "Payment USD 1,980.00 recorded · ESFCA wire"),
  act("a8", -14, "00:00", "invoice", "Status changed to overdue", "INV-0039", "Automatic · due date passed"),
];

export const seedExports: DataExport[] = [
  { id: "x-1", requestedAt: ts(-54), status: "expired", fileName: "paylancr-export-1.zip", sizeLabel: "3.1 MB" },
  { id: "x-2", requestedAt: ts(-125), status: "expired", fileName: "paylancr-export-2.zip", sizeLabel: "1.8 MB" },
];
