import { describe, expect, it } from "vitest";
import type { InvoiceView } from "@/lib/selectors";
import type { Payment, Project, TimeEntry } from "@/lib/types";
import { attentionInvoices, cashIn, currencyEntries, estimateTarget, monthRange, outstandingBy, overdueBy, recentPayments, unbilledSummary } from "./aggregate";

const TODAY = "2026-10-05";
const pay = (date: string, amount: number, id = date): Payment => ({ id, amount, date, method: "Raast", reference: "", recordedAt: `${date}T10:00:00Z` });
const inv = (over: Partial<InvoiceView> & { display: InvoiceView["display"] }): InvoiceView =>
  ({ id: "i", number: "INV-1", currency: "USD", dueDate: "2026-10-20", payments: [], totals: { balance: 100, total: 100, paid: 0, subtotal: 100, discount: 0, taxable: 100, tax: 0 }, ...over } as unknown as InvoiceView);

describe("monthRange", () => {
  it("returns first and last day, with offsets", () => {
    expect(monthRange(TODAY)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(monthRange(TODAY, -1)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });
});

describe("cashIn", () => {
  it("sums payments inside the range per currency", () => {
    const views = [
      inv({ display: "paid", currency: "USD", payments: [pay("2026-10-02", 500), pay("2026-09-30", 900)] }),
      inv({ display: "partial", currency: "PKR", payments: [pay("2026-10-01", 3000000)] }),
    ];
    expect(cashIn(views, monthRange(TODAY))).toEqual({ USD: 500, PKR: 3000000 });
    expect(cashIn(views, monthRange(TODAY, -1))).toEqual({ USD: 900 });
  });
});

describe("outstanding / overdue", () => {
  const views = [
    inv({ display: "unpaid", totals: { balance: 100 } as InvoiceView["totals"] }),
    inv({ display: "partial", totals: { balance: 50 } as InvoiceView["totals"] }),
    inv({ display: "overdue", currency: "PKR", dueDate: "2026-09-20", totals: { balance: 700 } as InvoiceView["totals"] }),
    inv({ display: "paid", totals: { balance: 0 } as InvoiceView["totals"] }),
    inv({ display: "draft" }),
  ];
  it("counts only live invoices", () => {
    expect(outstandingBy(views)).toEqual({ by: { USD: 150, PKR: 700 }, count: 3 });
  });
  it("overdue only", () => {
    const o = overdueBy(views);
    expect(o.by).toEqual({ PKR: 700 });
    expect(o.items).toHaveLength(1);
  });
});

describe("recentPayments", () => {
  it("sorts newest first and limits", () => {
    const views = [inv({ display: "paid", payments: [pay("2026-10-01", 1, "a"), pay("2026-10-03", 2, "b"), pay("2026-09-01", 3, "c")] })];
    expect(recentPayments(views, 2).map((r) => r.payment.id)).toEqual(["b", "a"]);
  });
});

describe("attentionInvoices", () => {
  it("orders overdue, due soon, then draft and skips the rest", () => {
    const views = [
      inv({ id: "draft", display: "draft" }),
      inv({ id: "soon", display: "unpaid", dueDate: "2026-10-07" }),
      inv({ id: "late", display: "overdue", dueDate: "2026-09-20" }),
      inv({ id: "later", display: "overdue", dueDate: "2026-10-01" }),
      inv({ id: "far", display: "unpaid", dueDate: "2026-10-30" }),
    ];
    const out = attentionInvoices(views, TODAY);
    expect(out.map((o) => o.view.id)).toEqual(["late", "later", "soon", "draft"]);
    expect(out[0]).toMatchObject({ reason: "overdue", days: 15 });
    expect(out[2]).toMatchObject({ reason: "due_soon", days: 2 });
  });
});

describe("unbilledSummary", () => {
  it("adds hourly time and ready retainer periods per currency, skipping completed projects", () => {
    const base = { clientId: "c", status: "active" as const, startDate: "2026-01-01", milestones: [], shareToken: "t", notes: "", currency: "USD" as const };
    const projects: Project[] = [
      { ...base, id: "h", name: "H", billingType: "hourly", hourlyRate: 4500, retainerPeriods: [] },
      { ...base, id: "r", name: "R", billingType: "retainer", retainerAmount: 1000, retainerPeriods: [{ id: "x", label: "Oct", start: "2026-10-01", end: "2026-10-31", amount: 1000 }] },
      { ...base, id: "d", name: "D", status: "completed", billingType: "hourly", hourlyRate: 100, retainerPeriods: [] },
    ];
    const time: TimeEntry[] = [{ id: "t", projectId: "h", description: "", date: "2026-10-01", minutes: 120, billable: true, updatedAt: "" }];
    const s = unbilledSummary(projects, time, TODAY);
    expect(s.by).toEqual({ USD: 10000 });
    expect(s).toMatchObject({ minutes: 120, items: 1, projects: 2 });
  });
});

describe("helpers", () => {
  it("currencyEntries drops zeros", () => expect(currencyEntries({ USD: 0, PKR: 5 })).toEqual([["PKR", 5]]));
  it("estimateTarget picks the other side", () => {
    expect(estimateTarget("USD", "USD")).toBe("PKR");
    expect(estimateTarget("PKR", "USD")).toBe("USD");
  });
});
