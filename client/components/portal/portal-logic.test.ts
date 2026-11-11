import { describe, expect, it } from "vitest";
import { responseToInvoice } from "@/lib/api/mappers/invoices";
import { invoiceResponseFixture, paymentResponseFixture } from "@/lib/test/invoices";
import { milestoneFixture } from "@/lib/test/projects";
import { dueLine, firstName, invoiceCaption, invoiceHero, isDecidable, lastPaymentDate, safeHttpUrl } from "./portal-logic";

const inv = (o = {}) => responseToInvoice(invoiceResponseFixture(o));

describe("invoice presentation", () => {
  it("describes due state", () => {
    const i = inv({ dueDate: "2026-09-20T00:00:00Z" });
    expect(dueLine(i, "unpaid", "2026-09-20")).toBe("Due today");
    expect(dueLine(i, "unpaid", "2026-09-01")).toMatch(/^Due /);
    expect(dueLine(i, "overdue", "2026-10-05")).toMatch(/15 days overdue/);
    expect(dueLine(i, "overdue", "2026-09-21")).toMatch(/1 day overdue/);
    expect(dueLine(i, "written_off")).toBe("Closed");
  });
  it("hero shows balance for live, total once paid or closed; only live ones are estimates", () => {
    const i = { ...inv(), total: 1000, balanceDue: 400, amountPaid: 600 };
    expect(invoiceHero(i, "unpaid")).toEqual({ label: "Amount due", amount: 400, estimate: true });
    expect(invoiceHero(i, "partial")).toMatchObject({ label: "Balance due", amount: 400, estimate: true });
    expect(invoiceHero(i, "paid")).toMatchObject({ amount: 1000, estimate: false });
    expect(invoiceHero(i, "written_off")).toMatchObject({ label: "Invoice total", estimate: false });
  });
  it("captions each state", () => {
    const i = { ...inv(), balanceDue: 400, amountPaid: 600 };
    expect(invoiceCaption(i, "partial")).toContain("to go");
    expect(invoiceCaption(i, "overdue")).toContain("past its due date");
    expect(invoiceCaption(i, "unpaid")).toContain("directly");
  });
  it("finds the last payment date", () => {
    const i = inv({ payments: [paymentResponseFixture({ paidAt: "2026-03-02T10:00:00Z" }), paymentResponseFixture({ id: "b", paidAt: "2026-04-01T10:00:00Z" })] });
    expect(lastPaymentDate(i)).toBe("2026-04-01");
  });
});

describe("helpers", () => {
  it("only milestones that are submitted can be decided", () => {
    expect(isDecidable(milestoneFixture({ status: "submitted" }))).toBe(true);
    expect(isDecidable(milestoneFixture({ status: "approved" }))).toBe(false);
  });
  it("firstName", () => {
    expect(firstName("Ayesha Khan")).toBe("Ayesha");
    expect(firstName(undefined)).toBe("the freelancer");
  });
  it("allows only http(s) links", () => {
    expect(safeHttpUrl("https://payoneer.com/pay/x")).toBe("https://payoneer.com/pay/x");
    expect(safeHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("not a url")).toBeUndefined();
    expect(safeHttpUrl(undefined)).toBeUndefined();
  });
});
