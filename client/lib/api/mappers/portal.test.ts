import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { exchangeRatesFixture } from "@/lib/test/exchange-rates";
import { portalInvoiceResponseFixture } from "@/lib/test/invoices";
import { milestoneResponseFixture } from "@/lib/test/projects";
import { classifyPortalError, portalInvoiceToView, portalMilestoneToView, portalProjectToView } from "./portal";

const httpErr = (status?: number, data: unknown = {}) => {
  const e = new AxiosError("x");
  if (status) e.response = { status, data, statusText: "", headers: {}, config: {} as never };
  return e;
};

describe("portalInvoiceToView", () => {
  it("maps each display status", () => {
    const pairs = [["OVERDUE", "overdue"], ["PAID", "paid"], ["PARTIALLY_PAID", "partial"], ["WRITTEN_OFF", "written_off"]] as const;
    for (const [api, ui] of pairs) expect(portalInvoiceToView(portalInvoiceResponseFixture({ displayStatus: api })).invoice.status).toBe(ui);
  });
  it("exchangeRates null vs present", () => {
    expect(portalInvoiceToView(portalInvoiceResponseFixture()).rates).toBeNull();
    const v = portalInvoiceToView(portalInvoiceResponseFixture({ exchangeRates: exchangeRatesFixture() }));
    expect(v.rates?.rates.PKR).toBeTruthy();
  });
  it("keeps the disclaimer", () => {
    expect(portalInvoiceToView(portalInvoiceResponseFixture({ paymentDisclaimer: "Pay directly." })).invoice.paymentDisclaimer).toBe("Pay directly.");
  });
});

describe("portal project and milestone", () => {
  it("maps a project", () => {
    const p = portalProjectToView({ id: "p", name: "Site", description: null, status: "ACTIVE", dueDate: "2026-05-01T00:00:00Z", currency: "EUR" });
    expect(p).toMatchObject({ status: "active", dueDate: "2026-05-01", currency: "EUR", description: undefined });
  });
  it("maps a milestone", () => {
    expect(portalMilestoneToView(milestoneResponseFixture({ status: "SUBMITTED" })).status).toBe("submitted");
  });
});

describe("classifyPortalError", () => {
  it.each([[401, "expired"], [403, "expired"], [404, "notfound"], [429, "ratelimited"], [400, "decision"], [500, "unknown"]] as const)("%s -> %s", (s, kind) => {
    expect(classifyPortalError(httpErr(s, { detail: "nope" })).kind).toBe(kind);
  });
  it("carries the 400 detail and detects offline", () => {
    expect(classifyPortalError(httpErr(400, { detail: "Not submitted" })).message).toBe("Not submitted");
    expect(classifyPortalError(httpErr()).kind).toBe("offline");
  });
});
