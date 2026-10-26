import { describe, expect, it } from "vitest";
import type { ApiInvoiceDisplayStatus, ApiInvoiceEventType } from "@/lib/api/invoices.types";
import { eventResponseFixture, invoiceResponseFixture, paymentResponseFixture, sendResponseFixture, snapshotFixture } from "@/lib/test/invoices";
import {
  DISPLAY_STATUS, EVENT_LABEL, PAYMENT_METHOD_LABEL, RECORDABLE_METHODS, preferredPaymentMethod, responseToEvent, responseToInvoice,
  responseToShare, savedTypeToPaymentMethod, snapshotToMethod, toPaymentCreate,
} from "./invoices";

describe("displayStatus -> chip status", () => {
  const cases: [ApiInvoiceDisplayStatus, string][] = [
    ["DRAFT", "draft"], ["SENT", "unpaid"], ["PARTIALLY_PAID", "partial"], ["PAID", "paid"],
    ["WRITTEN_OFF", "written_off"], ["CANCELLED", "void"], ["OVERDUE", "overdue"],
  ];
  it.each(cases)("%s -> %s", (api, ui) => {
    expect(DISPLAY_STATUS[api]).toBe(ui);
    expect(responseToInvoice(invoiceResponseFixture({ displayStatus: api })).status).toBe(ui);
  });
  it("covers all seven values", () => expect(Object.keys(DISPLAY_STATUS)).toHaveLength(7));
});

describe("responseToInvoice", () => {
  it("converts every money field to minor units and takes totals from the server", () => {
    const inv = responseToInvoice(invoiceResponseFixture({
      subtotal: "1000.00", discountAmount: "100.00", taxAmount: "90.00", withholdingAmount: "45.50", total: "990.00", amountPaid: "400.00", balanceDue: "590.00",
      payments: [paymentResponseFixture()],
    }));
    expect(inv).toMatchObject({ subtotal: 100000, discountAmount: 10000, taxAmount: 9000, withholdingAmount: 4550, total: 99000, amountPaid: 40000, balanceDue: 59000 });
    expect(inv.items[0]).toMatchObject({ quantity: 20, unitPrice: 5000, amount: 100000, fromTime: true });
    expect(inv.payments[0]).toMatchObject({ amount: 40000, method: "BANK_TRANSFER", reference: undefined });
  });

  it("uses the currency's exponent and keeps dates as ISO days", () => {
    const inv = responseToInvoice(invoiceResponseFixture({ currency: "PKR", total: "18000.00" }));
    expect(inv.total).toBe(18000);
    expect(inv).toMatchObject({ issueDate: "2026-10-01", dueDate: "2026-11-15", number: "INV-0001" });
  });

  it("maps tax lines, including withholding", () => {
    const inv = responseToInvoice(invoiceResponseFixture({
      taxes: [
        { name: "GST", rate: "17.00", amount: "170.00", isInclusive: false, isCompound: false, isWithholding: false },
        { name: "WHT", rate: "4.50", amount: "45.00", isInclusive: false, isCompound: false, isWithholding: true },
      ],
    }));
    expect(inv.taxes.map((t) => [t.name, t.amount, t.isWithholding])).toEqual([["GST", 17000, false], ["WHT", 4500, true]]);
  });

  it("drops null optionals", () => {
    const inv = responseToInvoice(invoiceResponseFixture({ viewedAt: null, notes: null }));
    expect(inv.viewedAt).toBeUndefined();
    expect(inv.notes).toBeUndefined();
    expect(inv.sentAt).toBe("2026-10-01T09:00:00Z");
  });
});

describe("snapshotToMethod", () => {
  it("maps the type to a kind and keeps a Payoneer payLink", () => {
    const m = snapshotToMethod(snapshotFixture({ type: "PAYONEER", label: "Payoneer", details: { paymentRequestUrl: "https://payoneer.com/x" }, payLink: "https://payoneer.com/x" }));
    expect(m).toMatchObject({ kind: "payoneer", payLink: "https://payoneer.com/x", fields: { paymentRequestUrl: "https://payoneer.com/x" } });
  });
  it("keeps the bank scheme and splits it from the fields", () => {
    const m = snapshotToMethod(snapshotFixture());
    expect(m.kind).toBe("bank");
    expect(m.scheme).toBe("IBAN");
    expect(m.fields.scheme).toBeUndefined();
    expect(m.payLink).toBeUndefined();
  });
});

describe("payment method enum mapping", () => {
  it("PKR_BANK_TRANSFER becomes BANK_TRANSFER, others pass through", () => {
    expect(savedTypeToPaymentMethod("PKR_BANK_TRANSFER")).toBe("BANK_TRANSFER");
    expect(savedTypeToPaymentMethod("RAAST")).toBe("RAAST");
    expect(savedTypeToPaymentMethod("OTHER")).toBe("OTHER");
  });
  it("offers CASH but not the legacy CARD / CHEQUE / PAYPAL, which still have labels", () => {
    expect(RECORDABLE_METHODS).toContain("CASH");
    for (const legacy of ["CARD", "CHEQUE", "PAYPAL"] as const) {
      expect(RECORDABLE_METHODS).not.toContain(legacy);
      expect(PAYMENT_METHOD_LABEL[legacy]).toBeTruthy();
    }
  });
  it("pre-selects from the invoice's first listed method", () => {
    expect(preferredPaymentMethod([{ kind: "raast" }, { kind: "bank" }])).toBe("RAAST");
    expect(preferredPaymentMethod([{ kind: "pkrbank" }])).toBe("BANK_TRANSFER");
    expect(preferredPaymentMethod([])).toBe("BANK_TRANSFER");
  });
});

describe("toPaymentCreate", () => {
  it("sends decimals, omits paidAt for today and an empty reference", () => {
    expect(toPaymentCreate({ amount: 40000, date: "2026-10-26", method: "CASH", reference: " " }, "USD", "2026-10-26")).toEqual({ amount: "400.00", method: "CASH" });
  });
  it("sends a past date as UTC midnight and a trimmed reference", () => {
    expect(toPaymentCreate({ amount: 5, date: "2026-10-20", method: "RAAST", reference: " TX1 " }, "USD", "2026-10-26")).toEqual({
      amount: "0.05", method: "RAAST", paidAt: "2026-10-20T00:00:00Z", reference: "TX1",
    });
  });
});

describe("events", () => {
  const types: ApiInvoiceEventType[] = ["SENT", "VIEWED", "REMINDED", "PAYMENT_RECORDED", "PAID", "WRITTEN_OFF", "CANCELLED", "EMAIL_FAILED"];
  it.each(types)("labels %s", (t) => {
    expect(EVENT_LABEL[t]).toBeTruthy();
    expect(responseToEvent(eventResponseFixture({ eventType: t, detail: "why" }))).toEqual({ id: "ev1", type: t, at: "2026-10-01T09:00:00Z", detail: "why" });
  });
});

describe("responseToShare", () => {
  it("maps links, the delivery flag and the invoice", () => {
    const s = responseToShare(sendResponseFixture({ emailDelivered: false }));
    expect(s).toMatchObject({ portalUrl: "https://app.example/i/tok", emailDelivered: false });
    expect(s.invoice.number).toBe("INV-0001");
  });
});
