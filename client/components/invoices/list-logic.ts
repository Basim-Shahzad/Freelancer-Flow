import type { InvoiceView } from "@/lib/selectors";

export type StatusFilter = "all" | "draft" | "unpaid" | "overdue" | "paid";

/** "Unpaid" also covers partially paid invoices, as in the design. */
export function matchesStatus(v: InvoiceView, f: StatusFilter): boolean {
  if (f === "all") return true;
  if (f === "unpaid") return v.display === "unpaid" || v.display === "partial";
  return v.display === f;
}

export function matchesQuery(v: InvoiceView, q: string, projectName: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return `${v.number} ${v.client?.name ?? ""} ${projectName}`.toLowerCase().includes(needle);
}

export function filterInvoices(views: InvoiceView[], o: { q: string; clientId: string; status: StatusFilter }): InvoiceView[] {
  return views.filter((v) => (o.clientId === "all" || v.clientId === o.clientId) && matchesStatus(v, o.status) && matchesQuery(v, o.q, v.project?.name ?? ""));
}

/** Newest number first ("INV-0045" before "INV-0044"). */
export const byNumberDesc = (a: { number: string }, b: { number: string }) => b.number.localeCompare(a.number, undefined, { numeric: true });

/** "8 invoices · 1 overdue" */
export function countLine(views: InvoiceView[]): string {
  const overdue = views.filter((v) => v.display === "overdue").length;
  return `${views.length} ${views.length === 1 ? "invoice" : "invoices"}${overdue ? ` · ${overdue} overdue` : ""}`;
}
