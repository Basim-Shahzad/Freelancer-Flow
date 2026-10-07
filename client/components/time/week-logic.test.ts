import { describe, expect, it } from "vitest";
import type { Invoice, Project, TimeEntry } from "@/lib/types";
import {
  amountFor, axisTicks, blockGeometry, bucketWeek, classifyAll, classifyEntry, heatBackground, heatLevel, heatWeeks, hourRange, isWeekend,
  layoutDay, moneyList, projectBreakdown, shiftWeek, shortDuration, summarizeWeek, unbilledByProject, weekDays, weekStartOf,
} from "./week-logic";

const entry = (o: Partial<TimeEntry> & { id: string }): TimeEntry => ({ description: "x", date: "2026-10-05", minutes: 60, billable: true, projectId: "h", updatedAt: "2026-10-05T10:00:00.000Z", ...o });
const project = (o: Partial<Project> & { id: string }): Project => ({
  clientId: "c", name: o.id, billingType: "hourly", currency: "USD", status: "active", startDate: "2026-01-01", hourlyRate: 6000, milestones: [], retainerPeriods: [], shareToken: "t", notes: "", ...o,
});
const invoice = (o: Partial<Invoice>): Invoice => ({
  id: "i", number: "INV-1", clientId: "c", currency: "USD", status: "unpaid", issueDate: "2026-09-01", dueDate: "2026-12-31",
  lines: [{ id: "l", description: "d", qty: 1, rate: 10000 }], taxPercent: 0, discount: 0, paymentMethodIds: [], note: "", shareToken: "t", payments: [], events: [], ...o,
});

describe("weeks", () => {
  it("starts on Monday and lists 7 days", () => {
    expect(weekStartOf("2026-10-07")).toBe("2026-10-05"); // Wednesday
    expect(weekStartOf("2026-10-11")).toBe("2026-10-05"); // Sunday belongs to the week before
    expect(weekDays("2026-10-05")).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
    expect(shiftWeek("2026-10-05", -1)).toBe("2026-09-28");
    expect(isWeekend("2026-10-10")).toBe(true);
    expect(isWeekend("2026-10-09")).toBe(false);
  });
  it("buckets entries into days and ignores other weeks", () => {
    const m = bucketWeek([entry({ id: "a" }), entry({ id: "b", date: "2026-10-11" }), entry({ id: "c", date: "2026-10-12" })], "2026-10-05");
    expect(m.get("2026-10-05")?.map((e) => e.id)).toEqual(["a"]);
    expect(m.get("2026-10-11")?.map((e) => e.id)).toEqual(["b"]);
    expect(m.get("2026-10-06")).toEqual([]);
    expect([...m.values()].flat()).toHaveLength(2);
  });
  it("builds twelve week starts ending with the current one", () => {
    const w = heatWeeks("2026-10-05");
    expect(w).toHaveLength(12);
    expect(w[11]).toBe("2026-10-05");
    expect(w[0]).toBe("2026-07-20");
  });
});

describe("classifyEntry", () => {
  const hourly = project({ id: "h" });
  it("non-billable and internal time", () => {
    expect(classifyEntry(entry({ id: "a", billable: false }), hourly, undefined)).toBe("nonbill");
    expect(classifyEntry(entry({ id: "a", projectId: undefined }), undefined, undefined)).toBe("nonbill");
  });
  it("fixed, milestone and retainer are inside the fee", () => {
    for (const billingType of ["fixed", "milestone", "retainer"] as const) {
      expect(classifyEntry(entry({ id: "a" }), project({ id: "h", billingType }), undefined)).toBe("fee");
    }
  });
  it("hourly: unbilled, invoiced, paid; void releases hours", () => {
    expect(classifyEntry(entry({ id: "a" }), hourly, undefined)).toBe("unbilled");
    expect(classifyEntry(entry({ id: "a", invoiceId: "i" }), hourly, invoice({}))).toBe("invoiced");
    expect(classifyEntry(entry({ id: "a", invoiceId: "i" }), hourly, invoice({ status: "draft" }))).toBe("invoiced");
    expect(classifyEntry(entry({ id: "a", invoiceId: "i" }), hourly, invoice({ dueDate: "2020-01-01" }))).toBe("invoiced"); // overdue is still invoiced
    expect(classifyEntry(entry({ id: "a", invoiceId: "i" }), hourly, invoice({ payments: [{ id: "p", amount: 10000, date: "2026-09-02", method: "bank", reference: "", recordedAt: "" }] }))).toBe("paid");
    expect(classifyEntry(entry({ id: "a", invoiceId: "i" }), hourly, invoice({ status: "void" }))).toBe("unbilled");
  });
});

describe("layoutDay / geometry", () => {
  it("stacks entries from 09:00 with a gap, oldest edit first", () => {
    const b = layoutDay([{ id: "b", minutes: 60, order: "2" }, { id: "a", minutes: 90, order: "1" }]);
    expect(b.find((x) => x.id === "a")).toMatchObject({ startMin: 540, endMin: 630, lanes: 1, lane: 0 });
    expect(b.find((x) => x.id === "b")).toMatchObject({ startMin: 645, endMin: 705 });
  });
  it("puts overlapping fixed-start blocks side by side", () => {
    const b = layoutDay([{ id: "a", minutes: 120, order: "1" }, { id: "run", minutes: 60, startMin: 600 }]);
    expect(b.map((x) => x.lanes)).toEqual([2, 2]);
    expect(new Set(b.map((x) => x.lane)).size).toBe(2);
  });
  it("never runs past midnight", () => {
    const b = layoutDay([{ id: "a", minutes: 2000 }]);
    expect(b[0]?.endMin).toBe(1440);
  });
  it("keeps 08–20 by default and widens for outliers", () => {
    expect(hourRange([{ startMin: 540, endMin: 700 }])).toEqual({ start: 8, end: 20 });
    expect(hourRange([{ startMin: 6 * 60 + 30, endMin: 21 * 60 + 10 }])).toEqual({ start: 6, end: 22 });
    expect(hourRange([{ startMin: 0, endMin: 1440 }])).toEqual({ start: 0, end: 24 });
  });
  it("converts blocks to percentages of the axis", () => {
    const range = { start: 8, end: 20 };
    expect(blockGeometry({ startMin: 9 * 60, endMin: 12 * 60 }, range)).toEqual({ top: (60 / 720) * 100, height: (180 / 720) * 100 });
    const tiny = blockGeometry({ startMin: 9 * 60, endMin: 9 * 60 + 5 }, range);
    expect(tiny.height).toBeCloseTo((20 / 720) * 100);
    const clamped = blockGeometry({ startMin: 7 * 60, endMin: 9 * 60 }, range);
    expect(clamped.top).toBe(0);
    expect(axisTicks(range)).toEqual([8, 10, 12, 14, 16, 18, 20]);
  });
});

describe("summaries", () => {
  const projects = [project({ id: "h" }), project({ id: "h2", hourlyRate: 100000, currency: "PKR" }), project({ id: "f", billingType: "fixed" })];
  const items = classifyAll(
    [
      entry({ id: "1", minutes: 90 }),
      entry({ id: "2", minutes: 60, projectId: "h2" }),
      entry({ id: "3", minutes: 120, projectId: "f" }),
      entry({ id: "4", minutes: 30, billable: false }),
    ],
    projects,
    [],
  );
  it("values minutes per currency without summing across them", () => {
    expect(amountFor(90, 6000)).toBe(9000);
    const s = summarizeWeek(items, 15);
    expect(s).toMatchObject({ billable: 90 + 60 + 120 + 15, fee: 120, hourly: 90 + 60 + 15, unbilled: 150 });
    expect(moneyList(s.unbilledMoney)).toEqual([["PKR", 100000], ["USD", 9000]]);
  });
  it("lists unbilled projects biggest first", () => {
    expect(unbilledByProject(items).map((r) => [r.projectId, r.minutes])).toEqual([["h", 90], ["h2", 60]]);
  });
  it("breaks a week down per project with the running timer", () => {
    const rows = projectBreakdown(items, { projectId: "h", minutes: 45 });
    expect(rows[0]).toMatchObject({ projectId: "h", minutes: 165, byState: { unbilled: 90, nonbill: 30, live: 45 } });
    expect(rows.map((r) => r.projectId)).toEqual(["h", "f", "h2"]);
  });
});

describe("heatmap", () => {
  it("buckets hours per day into five levels", () => {
    expect([0, 30, 179, 180, 359, 360, 539, 540, 900].map(heatLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
  it("mixes the primary token by level", () => {
    expect(heatBackground(0)).toContain(" 0%");
    expect(heatBackground(600)).toContain(" 100%");
    expect(heatBackground(600)).toContain("var(--primary)");
  });
});

describe("shortDuration", () => {
  it("is compact", () => {
    expect([0, 45, 120, 210].map(shortDuration)).toEqual(["0m", "45m", "2h", "3h 30m"]);
  });
});
