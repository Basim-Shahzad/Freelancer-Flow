import { describe, expect, it } from "vitest";
import type { TimeEntry } from "@/lib/types";
import { entrySchema } from "./schema";
import { DEFAULT_FILTERS, deriveConflicts, filterEntries, groupByDay, isConflicted, serverVersionOf, weekTotalMinutes } from "./logic";

const e = (o: Partial<TimeEntry> & { id: string }): TimeEntry => ({ description: "x", date: "2026-10-05", minutes: 60, billable: true, updatedAt: "2026-10-05T10:00:00.000Z", ...o });

describe("filterEntries", () => {
  const list = [
    e({ id: "a", projectId: "p1" }),
    e({ id: "b", projectId: "p2", billable: false }),
    e({ id: "c", projectId: undefined, billable: false }),
    e({ id: "d", projectId: "p1", invoiceId: "inv" }),
  ];
  it("filters by project, billable and invoiced", () => {
    expect(filterEntries(list, DEFAULT_FILTERS)).toHaveLength(4);
    expect(filterEntries(list, { ...DEFAULT_FILTERS, project: "p1" }).map((x) => x.id)).toEqual(["a", "d"]);
    expect(filterEntries(list, { ...DEFAULT_FILTERS, project: "none" }).map((x) => x.id)).toEqual(["c"]);
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

describe("conflicts", () => {
  const now = new Date("2026-10-05T12:00:00.000Z").getTime();
  it("needs unsynced", () => {
    expect(isConflicted(e({ id: "a", updatedAt: "2026-09-01T10:00:00.000Z" }), now)).toBe(false);
  });
  it("flags unsynced entries stuck for more than a day", () => {
    expect(isConflicted(e({ id: "a", unsynced: true, updatedAt: "2026-10-03T10:00:00.000Z", date: "2026-10-03" }), now)).toBe(true);
  });
  it("flags back-dated offline edits but not fresh same-day ones", () => {
    expect(isConflicted(e({ id: "a", unsynced: true, updatedAt: "2026-10-05T11:00:00.000Z", date: "2026-10-03" }), now)).toBe(true);
    expect(isConflicted(e({ id: "a", unsynced: true, updatedAt: "2026-10-05T11:00:00.000Z", date: "2026-10-05" }), now)).toBe(false);
  });
  it("never flags invoiced entries; derives a differing server version", () => {
    expect(isConflicted(e({ id: "a", unsynced: true, invoiceId: "i", updatedAt: "2026-09-01T10:00:00.000Z" }), now)).toBe(false);
    const c = deriveConflicts([e({ id: "a", unsynced: true, updatedAt: "2026-09-01T10:00:00.000Z", minutes: 240 })], now);
    expect(c).toHaveLength(1);
    expect(c[0]?.server.minutes).toBe(210);
    expect(serverVersionOf(e({ id: "z", minutes: 20 })).minutes).toBe(50);
  });
});

describe("entrySchema", () => {
  const ok = { description: "Work", projectId: "", date: "2026-10-05", duration: "1:30", startTime: "", billable: false };
  it("accepts valid input", () => expect(entrySchema.safeParse(ok).success).toBe(true));
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
