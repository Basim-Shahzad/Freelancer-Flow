import { describe, expect, it } from "vitest";
import type { ApiInvoiceEventType } from "@/lib/api/invoices.types";
import type { InvoiceTimelineEvent } from "@/lib/types";
import { buildTimeline, relativeDays } from "./timeline";

const ev = (id: string, type: ApiInvoiceEventType, at: string, detail?: string): InvoiceTimelineEvent => ({ id, type, at, detail });
const inv = { createdAt: "2026-10-01T08:00:00Z", dueDate: "2026-10-10" };

describe("relativeDays", () => {
  it("formats future, today and past", () => {
    expect(relativeDays("2026-10-30", "2026-10-07")).toBe("in 23 days");
    expect(relativeDays("2026-10-08", "2026-10-07")).toBe("in 1 day");
    expect(relativeDays("2026-10-07", "2026-10-07")).toBe("today");
    expect(relativeDays("2026-09-22", "2026-10-07")).toBe("15 days ago");
  });
});

describe("buildTimeline", () => {
  const events = [
    ev("e3", "VIEWED", "2026-10-03T09:00:00Z"),
    ev("e2", "SENT", "2026-10-02T09:00:00Z"),
    ev("e4", "PAYMENT_RECORDED", "2026-10-04T09:00:00Z"),
  ];
  it("starts at creation, lists events oldest first, appends the due date as pending", () => {
    const t = buildTimeline(inv, events, "partial", "2026-10-07");
    expect(t.map((i) => i.id)).toEqual(["created", "e2", "e3", "e4", "due"]);
    expect(t.slice(0, -1).every((i) => !i.pending)).toBe(true);
    const due = t.at(-1);
    expect(due).toMatchObject({ pending: true, label: "Payment due" });
    expect(due?.when).toContain("in 3 days");
  });
  it("covers every server event type with a label", () => {
    const types: ApiInvoiceEventType[] = ["SENT", "VIEWED", "REMINDED", "PAYMENT_RECORDED", "PAID", "WRITTEN_OFF", "CANCELLED", "EMAIL_FAILED"];
    const t = buildTimeline(inv, types.map((type, i) => ev(type, type, `2026-10-0${i + 1}T09:00:00Z`)), "void", "2026-10-07");
    expect(t.slice(1).map((i) => i.label)).toEqual([
      "Sent to your client", "Opened by your client", "Reminder sent", "Payment recorded", "Paid in full", "Written off", "Cancelled", "Email could not be delivered",
    ]);
  });
  it("keeps the detail of an event (a write-off reason, a failed email)", () => {
    const t = buildTimeline(inv, [ev("w", "WRITTEN_OFF", "2026-10-05T09:00:00Z", "Client vanished")], "written_off", "2026-10-07");
    expect(t.find((i) => i.id === "w")?.detail).toBe("Client vanished");
  });
  it("marks an unpaid past-due date as overdue, never as a prediction", () => {
    const due = buildTimeline({ ...inv, dueDate: "2026-09-22" }, events, "overdue", "2026-10-07").at(-1);
    expect(due).toMatchObject({ label: "Payment was due", tone: "err", pending: true });
    expect(due?.when).toContain("15 days ago");
  });
  it("has no pending row for draft, paid, written off or cancelled", () => {
    for (const s of ["draft", "paid", "written_off", "void"] as const) {
      expect(buildTimeline(inv, events, s, "2026-10-07").some((i) => i.pending)).toBe(false);
    }
  });
  it("uses gold only for the paid event", () => {
    const t = buildTimeline(inv, [ev("a", "PAID", "2026-10-05T09:00:00Z"), ev("b", "PAYMENT_RECORDED", "2026-10-05T08:00:00Z")], "paid", "2026-10-07");
    expect(t.filter((i) => i.tone === "gold").map((i) => i.id)).toEqual(["a"]);
  });
  it("never invents text like a likely payment", () => {
    const t = buildTimeline(inv, events, "unpaid", "2026-10-07");
    expect(t.some((i) => /likely|expected|predict/i.test(i.label))).toBe(false);
  });
});
