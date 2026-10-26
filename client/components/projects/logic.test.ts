import { describe, expect, it } from "vitest";
import type { InvoiceView } from "@/lib/selectors";
import { milestoneFixture, scheduledProjectFixture } from "@/lib/test/projects";
import type { ProjectWithSchedule, TimeEntry } from "@/lib/types";
import { deriveStage, milestoneActions, milestoneState, projectProgress, progressText, rateLabel, stagePips, unbilledOf, unbilledWeeks } from "./logic";

const TODAY = "2026-10-05";

const project = (over: Partial<ProjectWithSchedule> = {}): ProjectWithSchedule => scheduledProjectFixture(over);
const view = (display: InvoiceView["display"], balance = 100, total = 100): InvoiceView =>
  ({ number: "INV-1", currency: "USD", dueDate: "2026-10-20", display, totals: { balance, total, paid: total - balance, subtotal: total, discount: 0, taxable: total, tax: 0 } } as unknown as InvoiceView);
const entry = (over: Partial<TimeEntry>): TimeEntry => ({ id: "t", projectId: "p", description: "x", date: "2026-10-01", minutes: 60, billable: true, updatedAt: "", ...over });
const period = { id: "2026-10-01", label: "Oct 2026", start: "2026-10-01", end: "2026-10-31", amount: 5 };

describe("deriveStage", () => {
  it("is work when nothing is pending", () => {
    expect(deriveStage(project(), [], [], TODAY).stage).toBe("work");
  });
  it("is approval when a milestone is submitted, even with open invoices", () => {
    const p = project({ billingType: "milestone", milestones: [milestoneFixture({ status: "submitted", title: "Design" })] });
    expect(deriveStage(p, [view("unpaid")], [], TODAY).stage).toBe("approval");
  });
  it("is invoice when hourly time is unbilled, and instructions once billed", () => {
    const p = project({ billingType: "hourly", hourlyRate: 4500 });
    expect(deriveStage(p, [], [entry({})], TODAY).stage).toBe("invoice");
    expect(deriveStage(p, [view("unpaid")], [entry({ invoiceId: "i" })], TODAY).stage).toBe("instructions");
  });
  it("is invoice for a draft", () => {
    expect(deriveStage(project(), [view("draft")], [], TODAY).stage).toBe("invoice");
  });
  it("is paid when completed and settled, or when every milestone is approved", () => {
    expect(deriveStage(project({ status: "completed" }), [view("paid", 0)], [], TODAY).stage).toBe("paid");
    const p = project({ milestones: [milestoneFixture({ status: "approved" })] });
    expect(deriveStage(p, [view("paid", 0)], [], TODAY).stage).toBe("paid");
  });
  it("a retainer period without an invoice is ready to invoice", () => {
    const p = project({ billingType: "retainer", retainerPeriods: [period] });
    expect(deriveStage(p, [], [], TODAY).stage).toBe("invoice");
    expect(deriveStage({ ...p, retainerPeriods: [{ ...period, invoiceId: "i" }] }, [], [], TODAY).stage).toBe("work");
  });
});

describe("stagePips", () => {
  it("marks earlier stages done and the current one", () => {
    expect(stagePips("invoice")).toEqual(["done", "done", "current", "todo", "todo"]);
  });
});

describe("projectProgress", () => {
  it("uses the server's percentage, clamped", () => {
    expect(projectProgress({ progressPercent: 45, milestonesEnabled: true })).toEqual({ pct: 45, basis: "from milestones" });
    expect(projectProgress({ progressPercent: 140, milestonesEnabled: false })?.pct).toBe(100);
  });
  it("is null when the server sends null, and renders as a dash", () => {
    expect(projectProgress({ progressPercent: null, milestonesEnabled: false })).toBeNull();
    expect(progressText({ progressPercent: null })).toBe("—");
    expect(progressText({ progressPercent: 0 })).toBe("0%");
    expect(progressText({ progressPercent: 60 })).toBe("60%");
  });
});

describe("unbilled work", () => {
  const p = project({ billingType: "hourly", hourlyRate: 4500 });
  it("multiplies unbilled billable minutes by the rate in minor units", () => {
    const u = unbilledOf(p, [entry({ minutes: 90 }), entry({ billable: false }), entry({ invoiceId: "i" }), entry({ projectId: "other" })], TODAY);
    expect(u.minutes).toBe(90);
    expect(u.amount).toBe(6750);
  });
  it("counts started, uninvoiced retainer periods", () => {
    const r = project({ billingType: "retainer", retainerPeriods: [period, { ...period, id: "2026-09-01", start: "2026-09-01", invoiceId: "i" }, { ...period, id: "2026-11-01", start: "2026-11-01" }] });
    expect(unbilledOf(r, [], TODAY)).toMatchObject({ amount: 5, items: 1 });
  });
  it("groups by week starting Monday", () => {
    const weeks = unbilledWeeks(p, [entry({ date: "2026-10-05" }), entry({ date: "2026-10-01" }), entry({ date: "2026-09-29" })]);
    expect(weeks.map((w) => [w.key, w.entries])).toEqual([["2026-10-05", 1], ["2026-09-28", 2]]);
  });
});

describe("rateLabel", () => {
  it("describes each billing type", () => {
    expect(rateLabel(project({ billingType: "hourly", hourlyRate: 4500 }))).toBe("$45.00 / h");
    expect(rateLabel(project({ billingType: "hourly", hourlyRate: undefined }))).toBe("Profile rate");
    expect(rateLabel(project({ billingType: "retainer", retainerAmount: 130000, retainerInterval: "quarterly" }))).toBe("$1,300.00 / quarter");
    expect(rateLabel(project({ billingType: "fixed", budget: 360000 }))).toBe("$3,600.00");
    expect(rateLabel(project({ billingType: "milestone", budget: undefined }))).toBe("Per milestone");
  });
});

describe("milestoneState", () => {
  it("labels every status", () => {
    expect(milestoneState("pending")).toEqual({ label: "Not started", tone: "todo" });
    expect(milestoneState("submitted").tone).toBe("wait");
    expect(milestoneState("rejected").tone).toBe("warn");
    expect(milestoneState("approved").tone).toBe("done");
  });
});

describe("milestoneActions", () => {
  it("follows the server's transition matrix", () => {
    expect(milestoneActions({ status: "pending", approvalRequired: false })).toEqual({ canSubmit: true, moves: [{ to: "in_progress", label: "Start work" }] });
    expect(milestoneActions({ status: "in_progress", approvalRequired: false }).moves.map((m) => m.to)).toEqual(["pending", "approved"]);
    expect(milestoneActions({ status: "submitted", approvalRequired: true })).toMatchObject({ canSubmit: false, moves: [{ to: "in_progress" }] });
    expect(milestoneActions({ status: "rejected", approvalRequired: true })).toMatchObject({ canSubmit: true, moves: [{ to: "in_progress" }] });
    expect(milestoneActions({ status: "approved", approvalRequired: false })).toEqual({ canSubmit: false, moves: [] });
  });
  it("only a client can approve when approval is required", () => {
    expect(milestoneActions({ status: "in_progress", approvalRequired: true }).moves.map((m) => m.to)).toEqual(["pending"]);
  });
});
