import { describe, expect, it } from "vitest";
import { timeEntryFixture } from "@/lib/test/time-entries";
import type { TimeEntry } from "@/lib/types";
import { entrySchema } from "./schema";
import { DEFAULT_FILTERS, filterEntries, groupByDay, weekTotalMinutes } from "./logic";

const e = (o: Partial<TimeEntry> & { id: string }): TimeEntry => timeEntryFixture({ description: "x", projectId: undefined, startTime: undefined, ...o });

describe("filterEntries", () => {
  const list = [
    e({ id: "a", projectId: "p1" }),
    e({ id: "b", projectId: "p2", billable: false }),
    e({ id: "c", projectId: "p3", billable: false }),
    e({ id: "d", projectId: "p1", isInvoiced: true }),
  ];
  it("filters by project, billable and invoiced", () => {
    expect(filterEntries(list, DEFAULT_FILTERS)).toHaveLength(4);
    expect(filterEntries(list, { ...DEFAULT_FILTERS, project: "p1" }).map((x) => x.id)).toEqual(["a", "d"]);
    expect(filterEntries(list, { ...DEFAULT_FILTERS, billable: "non-billable" }).map((x) => x.id)).toEqual(["b", "c"]);
    expect(filterEntries(list, { ...DEFAULT_FILTERS, invoiced: "uninvoiced" }).map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(filterEntries(list, { ...DEFAULT_FILTERS, invoiced: "invoiced" }).map((x) => x.id)).toEqual(["d"]);
  });
});

describe("groupByDay", () => {
  it("groups newest day first with totals", () => {
    const g = groupByDay([e({ id: "a", date: "2026-10-03", minutes: 30 }), e({ id: "b", date: "2026-10-05", minutes: 45 }), e({ id: "c", date: "2026-10-03", minutes: 15 })]);
    expect(g.map((d) => d.date)).toEqual(["2026-10-05", "2026-10-03"]);
    expect(g[1]?.minutes).toBe(45);
  });
  it("adds the running timer to its day, creating the group when needed", () => {
    const g = groupByDay([e({ id: "a", date: "2026-10-03", minutes: 30 })], { date: "2026-10-05", minutes: 84 });
    expect(g[0]).toMatchObject({ date: "2026-10-05", minutes: 84, runningMinutes: 84, entries: [] });
    const h = groupByDay([e({ id: "a", minutes: 45 })], { date: "2026-10-05", minutes: 84 });
    expect(h[0]?.minutes).toBe(129);
  });
});

describe("weekTotalMinutes", () => {
  it("counts from Monday through today plus the running timer", () => {
    const list = [e({ id: "a", date: "2026-10-05", minutes: 45 }), e({ id: "b", date: "2026-10-04", minutes: 300 }), e({ id: "c", date: "2026-10-01", minutes: 60 })];
    expect(weekTotalMinutes(list, "2026-10-05", 84)).toBe(129); // Monday only
    expect(weekTotalMinutes(list, "2026-10-07")).toBe(45);
    expect(weekTotalMinutes([e({ id: "d", date: "2026-10-01", minutes: 60 })], "2026-10-02")).toBe(60);
  });
});

describe("entrySchema", () => {
  const ok = { description: "Work", projectId: "p1", milestoneId: "", date: "2026-10-05", duration: "1:30", startTime: "", billable: false };
  it("accepts valid input", () => expect(entrySchema.safeParse(ok).success).toBe(true));
  it("requires a project", () => {
    const r = entrySchema.safeParse({ ...ok, projectId: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/project/i);
  });
  it("accepts an optional HH:MM start time and rejects junk", () => {
    expect(entrySchema.safeParse({ ...ok, startTime: "09:30" }).success).toBe(true);
    expect(entrySchema.safeParse({ ...ok, startTime: "25:00" }).success).toBe(false);
  });
  it("rejects blank description, bad duration and bad date", () => {
    expect(entrySchema.safeParse({ ...ok, description: "  " }).success).toBe(false);
    expect(entrySchema.safeParse({ ...ok, duration: "abc" }).success).toBe(false);
    expect(entrySchema.safeParse({ ...ok, duration: "0" }).success).toBe(false);
    expect(entrySchema.safeParse({ ...ok, duration: "25" }).success).toBe(false);
    expect(entrySchema.safeParse({ ...ok, date: "" }).success).toBe(false);
  });
});
