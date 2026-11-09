import { describe, expect, it } from "vitest";
import type { DashboardSummary } from "@/lib/api/dashboard.types";
import { hoursToMinutes, mapDashboardSummary } from "./dashboard";

const empty: DashboardSummary = {
  cashIn: { thisMonth: [], lastMonth: [], thisMonthStart: "2026-11-01", lastMonthStart: "2026-10-01", timezone: "Asia/Karachi" },
  outstanding: { byCurrency: [] },
  unbilled: { time: [], milestones: [], retainerPeriods: [] },
  runningTimer: null,
  activeProjects: 0,
};

const full: DashboardSummary = {
  cashIn: { ...empty.cashIn, thisMonth: [{ currency: "USD", amount: "1250.50" }, { currency: "PKR", amount: "90000.00" }], lastMonth: [{ currency: "USD", amount: "10.00" }] },
  outstanding: { byCurrency: [
    { currency: "USD", balance: "300.25", count: 2, overdueBalance: "100.00", overdueCount: 1 },
    { currency: "PKR", balance: "5000.00", count: 1, overdueBalance: "0.00", overdueCount: 0 },
  ] },
  unbilled: {
    time: [{ projectId: "p1", projectName: "A", currency: "USD", hours: "2.50", amount: "250.00" }, { projectId: "p2", projectName: "B", currency: null, hours: "1.25", amount: "5000.00" }],
    milestones: [{ projectId: "p3", projectName: "C", currency: null, count: 2, amount: "40.00" }],
    retainerPeriods: [{ projectId: "p1", projectName: "A", currency: "USD", periodStart: "2026-10-01", periodEnd: "2026-10-31", label: "October", amount: "500.00" }],
  },
  runningTimer: { id: "t1", projectId: "p1", projectName: "A", description: "Work", startTime: "2026-11-10T08:00:00Z", elapsedMinutes: 42 },
  activeProjects: 3,
};

describe("mapDashboardSummary", () => {
  it("handles the no-data shape", () => {
    const v = mapDashboardSummary(empty);
    expect(v.isEmpty).toBe(true);
    expect(v.runningTimer).toBeNull();
    expect(v.unbilled).toMatchObject({ time: [], milestones: [], retainerPeriods: [], byCurrency: {}, minutes: 0 });
  });

  it("converts decimals to minor units per currency without mixing", () => {
    const v = mapDashboardSummary(full, (id) => (id === "p2" ? "PKR" : id === "p3" ? "USD" : undefined));
    expect(v.cashIn.thisMonth).toEqual({ USD: 125050, PKR: 90000 });
    expect(v.outstanding.USD).toEqual({ balance: 30025, count: 2, overdueBalance: 10000, overdueCount: 1 });
    expect(v.unbilled.byCurrency).toEqual({ USD: 25000 + 4000 + 50000, PKR: 5000 });
    expect(v.unbilled.minutes).toBe(150 + 75);
    expect(v.runningTimer).toMatchObject({ startAt: "2026-11-10T08:00:00Z", elapsedMinutes: 42 });
    expect(v.isEmpty).toBe(false);
  });

  it("skips unbilled rows whose currency cannot be resolved", () => {
    const v = mapDashboardSummary(full);
    expect(v.unbilled.time.map((t) => t.projectId)).toEqual(["p1"]);
    expect(v.unbilled.milestones).toEqual([]);
  });

  it("converts hours to minutes", () => {
    expect(hoursToMinutes("0.25")).toBe(15);
    expect(hoursToMinutes("12")).toBe(720);
    expect(hoursToMinutes("1.5")).toBe(90);
    expect(hoursToMinutes("x")).toBe(0);
  });
});
