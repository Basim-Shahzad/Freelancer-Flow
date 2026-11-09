import { daysBetween } from "@/lib/dates";
import type { InvoiceDetail } from "@/lib/types";

export type AttentionReason = "overdue" | "due_soon" | "draft";
export interface AttentionItem { view: InvoiceDetail; reason: AttentionReason; days: number }

/** Overdue first (most late first), then due within 3 days, then unsent drafts. Works on mapped invoices. */
export function attentionInvoices(invoices: InvoiceDetail[], today: string, limit = 5): AttentionItem[] {
  const items: AttentionItem[] = [];
  const seen = new Set<string>();
  for (const v of invoices) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    if (v.status === "overdue") items.push({ view: v, reason: "overdue", days: daysBetween(today, v.dueDate) });
    else if (v.status === "unpaid" || v.status === "partial") {
      const left = daysBetween(v.dueDate, today);
      if (left >= 0 && left <= 3) items.push({ view: v, reason: "due_soon", days: left });
    } else if (v.status === "draft") items.push({ view: v, reason: "draft", days: 0 });
  }
  const rank: Record<AttentionReason, number> = { overdue: 0, due_soon: 1, draft: 2 };
  items.sort((a, b) => rank[a.reason] - rank[b.reason] || (a.reason === "overdue" ? b.days - a.days : a.days - b.days));
  return items.slice(0, limit);
}
