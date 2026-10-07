import { describe, expect, it } from "vitest";
import { seedInvoices } from "@/lib/seed";
import type { Invoice, InvoiceEvent } from "@/lib/types";
import { buildTimeline, relativeDays } from "./timeline";

const ev = (id: string, type: InvoiceEvent["type"], at: string, label = id): InvoiceEvent => ({ id, type, at, label });
const base = (over: Partial<Invoice>): Invoice => {
  const inv = seedInvoices[0] as Invoice;
  return { ...inv, events: [], payments: [], dueDate: "2026-10-10", ...over };
};

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
    ev("e3", "viewed", "2026-10-03T09:00:00Z"),
    ev("e1", "created", "2026-10-01T09:00:00Z"),
    ev("e4", "edited", "2026-10-03T10:00:00Z"),
    ev("e2", "sent", "2026-10-02T09:00:00Z"),
    ev("e5", "payment", "2026-10-04T09:00:00Z"),
  ];
  it("lists real events oldest first, drops edits, appends the due date as pending", () => {
    const t = buildTimeline(base({ events }), "partial", "2026-10-07");
    expect(t.map((i) => i.id)).toEqual(["e1", "e2", "e3", "e5", "due"]);
    expect(t.slice(0, -1).every((i) => !i.pending)).toBe(true);
    const due = t.at(-1);
    expect(due).toMatchObject({ pending: true, label: "Payment due" });
    expect(due?.when).toContain("in 3 days");
  });
  it("marks an unpaid past-due date as overdue, never as a prediction", () => {
    const due = buildTimeline(base({ events, dueDate: "2026-09-22" }), "overdue", "2026-10-07").at(-1);
    expect(due).toMatchObject({ label: "Payment was due", tone: "err", pending: true });
    expect(due?.when).toContain("15 days ago");
  });
  it("has no pending row for draft, paid, written off or void", () => {
    for (const s of ["draft", "paid", "written_off", "void"] as const) {
      expect(buildTimeline(base({ events }), s, "2026-10-07").some((i) => i.pending)).toBe(false);
    }
  });
  it("uses gold only for the paid event", () => {
    const t = buildTimeline(base({ events: [ev("a", "paid", "2026-10-05T09:00:00Z"), ev("b", "payment", "2026-10-05T08:00:00Z")] }), "paid", "2026-10-07");
    expect(t.filter((i) => i.tone === "gold").map((i) => i.id)).toEqual(["a"]);
  });
  it("never invents text like a likely payment", () => {
    const t = buildTimeline(base({ events }), "unpaid", "2026-10-07");
    expect(t.some((i) => /likely|expected|predict/i.test(i.label))).toBe(false);
  });
});
