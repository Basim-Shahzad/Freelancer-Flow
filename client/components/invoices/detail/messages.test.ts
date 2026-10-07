import { describe, expect, it } from "vitest";
import type { InvoiceEvent } from "@/lib/types";
import { recordSchema } from "./schemas";
import { claimTail, eventTone, reminderMessage, shareLink, shareMessage, sortEvents, statusCaption, whatsappUrl, type ReminderInput } from "./messages";

const base: ReminderInput = { tone: "polite", contactName: "Jordan Reyes", ownerName: "Ayesha Malik", number: "INV-0042", amount: "USD 1,250.00", dueDate: "17 Oct 2026", overdueDays: 0, link: "https://app.example/i/k3x9q2" };

describe("reminderMessage", () => {
  it("polite, not yet due", () => {
    expect(reminderMessage(base)).toBe("Hi Jordan, a gentle reminder that invoice INV-0042 for USD 1,250.00 is due on 17 Oct 2026. You can see the payment details here: https://app.example/i/k3x9q2. Thank you. Ayesha");
  });
  it("every tone mentions number, amount, due date and link, and never says pay now", () => {
    for (const tone of ["polite", "firm", "final"] as const) {
      for (const overdueDays of [0, 18]) {
        const m = reminderMessage({ ...base, tone, overdueDays });
        for (const part of ["INV-0042", "USD 1,250.00", "17 Oct 2026", base.link, "Jordan", "Ayesha"]) expect(m).toContain(part);
        expect(m.toLowerCase()).not.toContain("pay now");
      }
    }
  });
  it("uses was due / days overdue when late, singular for one day", () => {
    expect(reminderMessage({ ...base, tone: "firm", overdueDays: 18 })).toContain("was due on 17 Oct 2026 and is now 18 days overdue");
    expect(reminderMessage({ ...base, tone: "final", overdueDays: 1 })).toContain("is 1 day overdue");
    expect(reminderMessage({ ...base, tone: "polite", overdueDays: 3 })).toContain("was due on");
  });
});

describe("links", () => {
  it("builds wa.me urls with digits only and encoded text", () => {
    expect(whatsappUrl("+1 512 555 0142", "Hi & bye")).toBe("https://wa.me/15125550142?text=Hi%20%26%20bye");
    expect(whatsappUrl(undefined, "x")).toBe("https://wa.me/?text=x");
  });
  it("builds share links and share messages", () => {
    expect(shareLink("https://a.test", "tok")).toBe("https://a.test/i/tok");
    expect(shareMessage({ contactName: "Sara Al", ownerName: "Ayesha M", businessName: "Malik Studio", number: "INV-1", amount: "USD 5.00", dueDate: "d", link: "L" })).toContain("Hi Sara, here is invoice INV-1 from Malik Studio");
  });
});

describe("timeline", () => {
  const ev = (id: string, type: InvoiceEvent["type"], at: string): InvoiceEvent => ({ id, type, at, label: id });
  it("sorts newest first and breaks ties by lifecycle stage", () => {
    const s = sortEvents([ev("created", "created", "2026-10-01T10:00:00Z"), ev("sent", "sent", "2026-10-01T10:00:00Z"), ev("pay", "payment", "2026-10-05T08:00:00Z"), ev("paid", "paid", "2026-10-05T08:00:00Z")]);
    expect(s.map((e) => e.id)).toEqual(["paid", "pay", "sent", "created"]);
  });
  it("tones: gold only for paid", () => {
    expect(eventTone("paid")).toBe("gold");
    expect(eventTone("payment")).toBe("ok");
    expect(eventTone("written_off")).toBe("warn");
    expect(eventTone("overdue")).toBe("err");
    const gold = (["created", "sent", "viewed", "reminder", "payment", "payment_reversed", "paid", "overdue", "written_off", "write_off_reversed", "void", "edited"] as const).filter((t) => eventTone(t) === "gold");
    expect(gold).toEqual(["paid"]);
  });
  it("captions", () => {
    const o = { paid: "USD 500.00", balance: "USD 750.00", overdueDays: 18, paidDate: "05 Oct 2026" };
    expect(statusCaption("partial", o)).toBe("USD 500.00 received · USD 750.00 to go");
    expect(statusCaption("overdue", o)).toBe("Payment is 18 days late");
    expect(statusCaption("paid", o)).toBe("Paid in full · 05 Oct 2026");
  });
});

describe("recordSchema", () => {
  const ok = { amount: "1,250.00", date: "2026-10-05", method: "Payoneer", reference: "" };
  it("accepts up to the balance and rejects zero, junk and overpayment", () => {
    const s = recordSchema(125000);
    expect(s.safeParse(ok).success).toBe(true);
    expect(s.safeParse({ ...ok, amount: "1250.01" }).success).toBe(false);
    expect(s.safeParse({ ...ok, amount: "0" }).success).toBe(false);
    expect(s.safeParse({ ...ok, amount: "abc" }).success).toBe(false);
    expect(s.safeParse({ ...ok, method: " " }).success).toBe(false);
    expect(s.safeParse({ ...ok, date: "" }).success).toBe(false);
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
  });
});
