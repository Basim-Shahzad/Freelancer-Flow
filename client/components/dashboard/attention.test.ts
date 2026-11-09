import { describe, expect, it } from "vitest";
import type { InvoiceDetail } from "@/lib/types";
import { attentionInvoices } from "./attention";

const inv = (id: string, status: InvoiceDetail["status"], dueDate: string) => ({ id, status, dueDate }) as InvoiceDetail;

describe("attentionInvoices", () => {
  it("ranks overdue (most late first), then due soon, then drafts, skipping the rest", () => {
    const out = attentionInvoices([
      inv("d", "draft", "2026-12-01"), inv("s", "unpaid", "2026-11-12"), inv("o1", "overdue", "2026-11-05"),
      inv("o2", "overdue", "2026-11-01"), inv("far", "unpaid", "2026-12-30"), inv("p", "paid", "2026-11-01"), inv("o1", "overdue", "2026-11-05"),
    ], "2026-11-10");
    expect(out.map((a) => a.view.id)).toEqual(["o2", "o1", "s", "d"]);
    expect(out[0]?.days).toBe(9);
  });
});
