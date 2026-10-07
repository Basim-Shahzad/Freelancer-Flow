import { describe, expect, it } from "vitest";
import type { InvoiceView } from "@/lib/selectors";
import type { Project, TimeEntry } from "@/lib/types";
import { buildRetainerPeriods, deriveStage, projectProgress, projectSummary, stagePips, unbilledOf, unbilledWeeks } from "./logic";

const TODAY = "2026-10-05";

const project = (over: Partial<Project>): Project => ({
  id: "p", clientId: "c", name: "P", billingType: "fixed", currency: "USD", status: "active", startDate: "2026-08-01",
  milestones: [], retainerPeriods: [], shareToken: "t", notes: "", ...over,
});
const view = (display: InvoiceView["display"], balance = 100, total = 100): InvoiceView =>
  ({ number: "INV-1", currency: "USD", dueDate: "2026-10-20", display, totals: { balance, total, paid: total - balance, subtotal: total, discount: 0, taxable: total, tax: 0 } } as unknown as InvoiceView);
const entry = (over: Partial<TimeEntry>): TimeEntry => ({ id: "t", projectId: "p", description: "x", date: "2026-10-01", minutes: 60, billable: true, updatedAt: "", ...over });

describe("deriveStage", () => {
  it("is work when nothing is pending", () => {
    expect(deriveStage(project({}), [], [], TODAY).stage).toBe("work");
  });
  it("is approval when a milestone awaits approval, even with open invoices", () => {
    const p = project({ billingType: "milestone", milestones: [{ id: "m", title: "Design", description: "", amount: 1, dueDate: TODAY, status: "awaiting_approval" }] });
    expect(deriveStage(p, [view("unpaid")], [], TODAY).stage).toBe("approval");
  });
  it("is invoice when an approved milestone has no invoice", () => {
    const p = project({ billingType: "milestone", milestones: [{ id: "m", title: "Design", description: "", amount: 1, dueDate: TODAY, status: "approved" }] });
    expect(deriveStage(p, [], [], TODAY).stage).toBe("invoice");
  });
  it("is invoice when hourly time is unbilled, and instructions once billed", () => {
    const p = project({ billingType: "hourly", hourlyRate: 4500 });
    expect(deriveStage(p, [], [entry({})], TODAY).stage).toBe("invoice");
    expect(deriveStage(p, [view("unpaid")], [entry({ invoiceId: "i" })], TODAY).stage).toBe("instructions");
  });
  it("is invoice for a draft", () => {
    expect(deriveStage(project({}), [view("draft")], [], TODAY).stage).toBe("invoice");
  });
  it("is paid when completed and settled", () => {
    expect(deriveStage(project({ status: "completed" }), [view("paid", 0)], [], TODAY).stage).toBe("paid");
  });
  it("retainer period without invoice is ready to invoice", () => {
    const p = project({ billingType: "retainer", retainerPeriods: [{ id: "r", label: "Oct 2026", start: "2026-10-01", end: "2026-10-31", amount: 5 }] });
    expect(deriveStage(p, [], [], TODAY).stage).toBe("invoice");
  });
});

describe("stagePips", () => {
  it("marks earlier stages done and the current one", () => {
    expect(stagePips("invoice")).toEqual(["done", "done", "current", "todo", "todo"]);
  });
});

describe("projectProgress", () => {
  it("uses approved milestones", () => {
    const m = (status: "approved" | "upcoming") => ({ id: status, title: "", description: "", amount: 1, dueDate: TODAY, status });
    expect(projectProgress(project({ milestones: [m("approved"), m("upcoming")] }), TODAY)?.pct).toBe(50);
  });
  it("uses the current retainer period", () => {
    const p = project({ billingType: "retainer", retainerPeriods: [{ id: "r", label: "Oct 2026", start: "2026-10-01", end: "2026-10-31", amount: 5 }] });
    expect(projectProgress(p, "2026-10-05")?.pct).toBe(16);
  });
  it("falls back to manual progress, clamped, or null", () => {
    expect(projectProgress(project({ progress: 140 }), TODAY)?.pct).toBe(100);
    expect(projectProgress(project({}), TODAY)).toBeNull();
  });
});

describe("unbilled work", () => {
  const p = project({ billingType: "hourly", hourlyRate: 4500 });
  it("multiplies unbilled billable minutes by the rate in minor units", () => {
    const u = unbilledOf(p, [entry({ minutes: 90 }), entry({ billable: false }), entry({ invoiceId: "i" }), entry({ projectId: "other" })], TODAY);
    expect(u.minutes).toBe(90);
    expect(u.amount).toBe(6750);
  });
  it("groups by week starting Monday", () => {
    const weeks = unbilledWeeks(p, [entry({ date: "2026-10-05" }), entry({ date: "2026-10-01" }), entry({ date: "2026-09-29" })]);
    expect(weeks.map((w) => [w.key, w.entries])).toEqual([["2026-10-05", 1], ["2026-09-28", 2]]);
  });
});

describe("projectSummary", () => {
  it("fixed: remaining never goes negative", () => {
    const s = projectSummary(project({ fixedAmount: 1000 }), [view("paid", 0, 1500)], [], TODAY);
    expect(s[2]?.money?.amount).toBe(0);
  });
});

describe("buildRetainerPeriods", () => {
  it("creates one period per month through today", () => {
    const r = buildRetainerPeriods("2026-08-15", 130000, TODAY);
    expect(r.map((x) => x.label)).toEqual(["Aug 2026", "Sep 2026", "Oct 2026"]);
    expect(r[0]).toMatchObject({ start: "2026-08-01", end: "2026-08-31", amount: 130000 });
  });
  it("creates the start month for a future start", () => {
    expect(buildRetainerPeriods("2026-12-01", 1, TODAY)).toHaveLength(1);
  });
});
