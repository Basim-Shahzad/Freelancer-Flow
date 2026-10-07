import { calcTotals, deriveStatus } from "./invoice";
import type { Client, Invoice, InvoiceStatus, Project } from "./types";

/** Read-model helpers shared by screens. Pure functions over store slices. */

export interface InvoiceView extends Invoice {
  /** Derived status (overdue / partial / paid). */
  display: InvoiceStatus;
  totals: ReturnType<typeof calcTotals>;
  client?: Client;
  project?: Project;
}

export function toInvoiceView(inv: Invoice, clients: Client[], projects: Project[]): InvoiceView {
  return { ...inv, display: deriveStatus(inv), totals: calcTotals(inv), client: clients.find((c) => c.id === inv.clientId), project: projects.find((p) => p.id === inv.projectId) };
}

export const byDateDesc = <T extends { issueDate: string }>(a: T, b: T) => (a.issueDate < b.issueDate ? 1 : a.issueDate > b.issueDate ? -1 : 0);

/** Outstanding (sent, unpaid balance) grouped by currency, in minor units. */
export function outstandingByCurrency(views: InvoiceView[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of views) {
    if (v.display === "unpaid" || v.display === "partial" || v.display === "overdue") out[v.currency] = (out[v.currency] ?? 0) + v.totals.balance;
  }
  return out;
}

export const clientName = (clients: Client[], id?: string) => clients.find((c) => c.id === id)?.name ?? "—";
export const projectName = (projects: Project[], id?: string) => projects.find((p) => p.id === id)?.name ?? "No project";
