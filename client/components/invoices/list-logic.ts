import type { InvoiceStatusFilter } from "@/lib/hooks/invoices";
import type { InvoiceStatus } from "@/lib/types";

/** Status filter options. "Unpaid" covers sent and partially paid invoices (the hook asks the server for both). */
export const STATUS_FILTERS: { value: InvoiceStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "unpaid", label: "Unpaid" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "written_off", label: "Written off" },
  { value: "void", label: "Cancelled" },
];

/** Small tag next to an amount when it is not simply the total. */
export const AMOUNT_TAGS: Partial<Record<InvoiceStatus, string>> = { partial: "balance", written_off: "written off", void: "cancelled" };

/** "8 invoices · 1 overdue" (the overdue count is the account-wide total, not the filtered one). */
export function countLine(total: number, overdue = 0): string {
  return `${total} ${total === 1 ? "invoice" : "invoices"}${overdue ? ` · ${overdue} overdue` : ""}`;
}
