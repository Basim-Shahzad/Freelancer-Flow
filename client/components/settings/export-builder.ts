import { calcTotals, deriveStatus } from "@/lib/invoice";
import { isoDate, parse } from "@/lib/dates";
import type { BusinessProfile, Client, DataExport, Invoice, ActivityEntry, PaymentMethod, Project, TimeEntry } from "@/lib/types";

export interface ExportSource {
  business: BusinessProfile;
  clients: Client[];
  projects: Project[];
  time: TimeEntry[];
  invoices: Invoice[];
  methods: PaymentMethod[];
  activity: ActivityEntry[];
}

/** Exports stay downloadable for this long (matches the "works for 7 days" copy). */
export const EXPORT_TTL_DAYS = 7;

const major = (minor: number) => (minor / 100).toFixed(2);

/** Full JSON copy. Amounts are integer minor units, as stored. */
export function buildExportJson(src: ExportSource, now: Date = new Date()) {
  const clientName = (id: string) => src.clients.find((c) => c.id === id)?.name ?? "";
  return {
    app: "Paylancr",
    formatVersion: 1,
    exportedAt: now.toISOString(),
    note: "Amounts are integer minor units (cents / paisa).",
    business: src.business,
    clients: src.clients,
    projects: src.projects,
    time: src.time,
    invoices: src.invoices.map((inv) => ({ ...inv, derivedStatus: deriveStatus(inv, isoDate(now)), totals: calcTotals(inv) })),
    payments: src.invoices.flatMap((inv) =>
      inv.payments.map((p) => ({ ...p, invoiceId: inv.id, invoiceNumber: inv.number, client: clientName(inv.clientId), currency: inv.currency })),
    ),
    paymentMethods: src.methods,
    activity: src.activity,
  };
}

/** RFC 4180 cell, with a guard against spreadsheet formula injection for text cells. */
export function csvCell(value: string | number): string {
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const INVOICE_CSV_HEADER = ["Number", "Client", "Project", "Currency", "Status", "Issue date", "Due date", "Subtotal", "Discount", "Tax", "Total", "Paid", "Balance"];

/** One row per invoice. Decimal amounts (major units). Starts with a BOM so Excel reads UTF-8. */
export function invoicesToCsv(invoices: Invoice[], clients: Client[], projects: Project[], today: string = isoDate(new Date())): string {
  const rows = invoices.map((inv) => {
    const t = calcTotals(inv);
    return [
      inv.number,
      clients.find((c) => c.id === inv.clientId)?.name ?? "",
      projects.find((p) => p.id === inv.projectId)?.name ?? "",
      inv.currency,
      deriveStatus(inv, today),
      inv.issueDate,
      inv.dueDate,
      major(t.subtotal), major(t.discount), major(t.tax), major(t.total), major(t.paid), major(t.balance),
    ].map(csvCell).join(",");
  });
  return `﻿${[INVOICE_CSV_HEADER.join(","), ...rows].join("\r\n")}\r\n`;
}

export const exportFileName = (date: string | Date, ext: "json" | "csv" = "json") =>
  `${ext === "csv" ? "paylancr-invoices" : "paylancr-export"}-${typeof date === "string" ? isoDate(parse(date)) : isoDate(date)}.${ext}`;

export type ExportPhase = "idle" | "preparing" | "ready";

/** What the Export screen shows for the most recent request. */
export function exportPhase(latest: DataExport | undefined, nowMs: number): ExportPhase {
  if (!latest) return "idle";
  if (latest.status === "preparing") return "preparing";
  if (latest.status === "ready" && nowMs - new Date(latest.requestedAt).getTime() < EXPORT_TTL_DAYS * 86_400_000) return "ready";
  return "idle";
}

export const isExpired = (x: DataExport, nowMs: number) => x.status === "expired" || (x.status === "ready" && nowMs - new Date(x.requestedAt).getTime() >= EXPORT_TTL_DAYS * 86_400_000);

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
