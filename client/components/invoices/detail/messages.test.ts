import { describe, expect, it } from "vitest";
import type { ApiInvoiceEventType } from "@/lib/api/invoices.types";
import { claimTail, eventTone, statusCaption } from "./messages";
import { recordSchema } from "./schemas";

describe("timeline tones", () => {
  it("gold only for paid", () => {
    expect(eventTone("PAID")).toBe("gold");
    expect(eventTone("PAYMENT_RECORDED")).toBe("ok");
    expect(eventTone("WRITTEN_OFF")).toBe("warn");
    expect(eventTone("EMAIL_FAILED")).toBe("err");
    const all: ApiInvoiceEventType[] = ["SENT", "VIEWED", "REMINDED", "PAYMENT_RECORDED", "PAID", "WRITTEN_OFF", "CANCELLED", "EMAIL_FAILED"];
    expect(all.filter((t) => eventTone(t) === "gold")).toEqual(["PAID"]);
  });
});

describe("statusCaption", () => {
  it("captions", () => {
    const o = { paid: "USD 500.00", balance: "USD 750.00", overdueDays: 18, paidDate: "05 Oct 2026" };
    expect(statusCaption("partial", o)).toBe("USD 500.00 received · USD 750.00 to go");
    expect(statusCaption("overdue", o)).toBe("Payment is 18 days late");
    expect(statusCaption("paid", o)).toBe("Paid in full · 05 Oct 2026");
  });
});

describe("recordSchema", () => {
  const ok = { amount: "1,250.00", date: "2026-10-05", method: "BANK_TRANSFER" as const, reference: "" };
  it("accepts up to the balance and rejects zero, junk and overpayment", () => {
    const s = recordSchema(125000);
    expect(s.safeParse(ok).success).toBe(true);
    expect(s.safeParse({ ...ok, amount: "1250.01" }).success).toBe(false);
    expect(s.safeParse({ ...ok, amount: "0" }).success).toBe(false);
    expect(s.safeParse({ ...ok, amount: "abc" }).success).toBe(false);
    expect(s.safeParse({ ...ok, method: "CARD" }).success).toBe(false);
    expect(s.safeParse({ ...ok, method: "CASH" }).success).toBe(true);
    expect(s.safeParse({ ...ok, date: "" }).success).toBe(false);
  });
  it("rejects a reference that is too long", () => {
    expect(recordSchema(100).safeParse({ ...ok, amount: "1", reference: "x".repeat(300) }).success).toBe(false);
  });
});

describe("claimTail", () => {
  const o = { paid: "USD 100.00", balance: "USD 900.00", dueDate: "20 Sep 2026", overdueDays: 15, daysToDue: 23, paidDate: "05 Oct 2026", daysToPay: 4 };
  it("covers each status without predictions", () => {
    expect(claimTail("unpaid", o)).toBe("Due in 23 days.");
    expect(claimTail("unpaid", { ...o, daysToDue: 0 })).toBe("Due today.");
    expect(claimTail("partial", o)).toBe("USD 100.00 received, USD 900.00 to go. Due in 23 days.");
    expect(claimTail("overdue", o)).toBe("Due 20 Sep 2026 · 15 days overdue.");
    expect(claimTail("paid", o)).toBe("Paid 05 Oct 2026, 4 days after issue.");
    expect(claimTail("draft", o)).toMatch(/draft/);
    expect(claimTail("void", o)).toMatch(/Cancelled/);
  });
});
