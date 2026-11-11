import { daysFromToday as d } from "@/lib/dates";
import type { BusinessProfile, Invoice } from "@/lib/types";

/** Demo data for the marketing preview (marketing pages have no account or API data). Dates are relative to today. */
export const demoBusiness: BusinessProfile = {
  businessName: "Malik Studio", ownerName: "Ayesha Malik", email: "ayesha@maliks.studio",
  taxId: "1234567-8", address: "Gulberg III, Lahore, Pakistan", defaultCurrency: "USD", defaultTermsDays: 14,
  invoiceNumberFormat: "INV-{seq:04d}", paymentInstructions: "", hourlyRate: 4000,
};

const ts = (days: number, hm: string) => `${d(days)}T${hm}:00.000Z`;
const line = (id: string, description: string, qty: number, rate: number) => ({ id, description, qty, rate, source: { type: "manual" as const } });

export const demoInvoice: Invoice = {
  id: "inv-42", number: "INV-0042", clientId: "c-harbor", projectId: "p-harbor", currency: "USD", status: "unpaid",
  issueDate: d(-2), dueDate: d(12),
  lines: [line("l42a", "Mobile app QA · 28 Sep – 02 Oct", 25, 4500), line("l42b", "Sprint planning workshop", 1, 12500)],
  taxPercent: 0, discount: 0, paymentMethodIds: ["pm-payoneer", "pm-esfca"], note: "", payments: [],
  events: [
    { id: "e42a", type: "created", at: ts(-2, "10:14"), label: "Invoice created" },
    { id: "e42b", type: "sent", at: ts(-2, "10:20"), label: "Sent by email to jordan@harborlabs.example" },
  ],
};
