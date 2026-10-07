import { describe, expect, it } from "vitest";
import { calcTotals, deriveStatus, formatInvoiceNumber } from "./invoice";
import type { Invoice } from "./types";

const base: Invoice = {
  id: "i1", number: "INV-0001", clientId: "c1", currency: "USD", status: "unpaid",
  issueDate: "2026-10-01", dueDate: "2026-10-15",
  lines: [{ id: "l1", description: "Work", qty: 25, rate: 4500 }, { id: "l2", description: "Workshop", qty: 1, rate: 12500 }],
  taxPercent: 0, discount: 0, paymentMethodIds: [], note: "", shareToken: "t", payments: [], events: [],
};

describe("calcTotals", () => {
  it("sums lines in minor units", () => {
    expect(calcTotals(base).total).toBe(125000);
  });
  it("applies discount before tax and never goes negative", () => {
    const t = calcTotals({ ...base, discount: 5000, taxPercent: 10 });
    expect(t).toMatchObject({ subtotal: 125000, discount: 5000, tax: 12000, total: 132000 });
    expect(calcTotals({ ...base, discount: 999999 }).total).toBe(0);
  });
  it("computes balance from payments", () => {
    const t = calcTotals({ ...base, payments: [{ id: "p", amount: 50000, date: "2026-10-02", method: "x", reference: "", recordedAt: "" }] });
    expect(t.balance).toBe(75000);
  });
  it("zeroes balance when written off or void", () => {
    expect(calcTotals({ ...base, status: "written_off" }).balance).toBe(0);
    expect(calcTotals({ ...base, status: "void" }).balance).toBe(0);
  });
});

describe("deriveStatus", () => {
  it("is unpaid before the due date", () => expect(deriveStatus(base, "2026-10-05")).toBe("unpaid"));
  it("is overdue after the due date", () => expect(deriveStatus(base, "2026-10-20")).toBe("overdue"));
  it("is partial when part-paid and not late", () => {
    const inv = { ...base, payments: [{ id: "p", amount: 1000, date: "", method: "", reference: "", recordedAt: "" }] };
    expect(deriveStatus(inv, "2026-10-05")).toBe("partial");
    expect(deriveStatus(inv, "2026-10-20")).toBe("overdue");
  });
  it("is paid when fully paid even if late", () => {
    const inv = { ...base, payments: [{ id: "p", amount: 125000, date: "", method: "", reference: "", recordedAt: "" }] };
    expect(deriveStatus(inv, "2026-12-01")).toBe("paid");
  });
  it("keeps explicit statuses", () => {
    expect(deriveStatus({ ...base, status: "draft" }, "2027-01-01")).toBe("draft");
    expect(deriveStatus({ ...base, status: "written_off" }, "2027-01-01")).toBe("written_off");
  });
});

describe("formatInvoiceNumber", () => {
  it("pads", () => expect(formatInvoiceNumber("INV-", 42)).toBe("INV-0042"));
});
