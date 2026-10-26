import { describe, expect, it } from "vitest";
import { projectFixture } from "@/lib/test/projects";
import { timeEntryFixture } from "@/lib/test/time-entries";
import type { TimeEntry } from "@/lib/types";
import { rangeFor } from "./week-grid";
import { buildWeek } from "./week-model";

const entry = (o: Partial<TimeEntry> & { id: string }): TimeEntry => timeEntryFixture({ description: "x", projectId: undefined, startTime: undefined, ...o });
const ctx = { projects: [], clients: [], running: null, nowMs: new Date(2026, 9, 5, 12, 0).getTime(), today: "2026-10-05" };

describe("buildWeek start times", () => {
  it("uses startTime for the block position", () => {
    const { days } = buildWeek("2026-10-05", [entry({ id: "a", startTime: "13:30", minutes: 90 })], ctx);
    expect(days[0]?.blocks[0]).toMatchObject({ startMin: 810, endMin: 900 });
  });
  it("stacks entries without a startTime from 09:00", () => {
    const { days } = buildWeek("2026-10-05", [entry({ id: "a" }), entry({ id: "b", startTime: "09:00" })], ctx);
    expect(days[0]?.blocks.map((b) => b.startMin)).toEqual([540, 540]);
  });
});

describe("buildWeek with API data", () => {
  const hourly = projectFixture({ id: "p1", billingType: "hourly", hourlyRate: 4500 });

  it("groups entries by their local day and keeps the week to seven days", () => {
    const entries = [entry({ id: "mon", date: "2026-10-05" }), entry({ id: "wed", date: "2026-10-07" }), entry({ id: "next", date: "2026-10-12" })];
    const { days } = buildWeek("2026-10-05", entries, ctx);
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.blocks.map((b) => b.id))).toEqual([["mon"], [], ["wed"], [], [], [], []]);
  });

  it("marks an invoiced hourly entry as invoiced and locked, an uninvoiced one as unbilled", () => {
    const { days } = buildWeek("2026-10-05", [
      entry({ id: "inv", projectId: "p1", startTime: "09:00", isInvoiced: true }),
      entry({ id: "open", projectId: "p1", startTime: "11:00" }),
    ], { ...ctx, projects: [hourly] });
    const [inv, open] = days[0]!.blocks;
    expect(inv).toMatchObject({ state: "invoiced", invoiced: true });
    expect(inv!.label).toMatch(/locked to an invoice/);
    expect(open).toMatchObject({ state: "unbilled", invoiced: false });
  });

  it("flags unsynced and overlapping entries", () => {
    const { days } = buildWeek("2026-10-05", [entry({ id: "a", startTime: "09:00", unsynced: true, overlap: true })], ctx);
    expect(days[0]!.blocks[0]).toMatchObject({ unsynced: true, overlap: true });
    expect(days[0]!.blocks[0]!.label).toMatch(/overlaps another entry/);
  });

  it("puts the API's running entry on today as a live block", () => {
    const running = timeEntryFixture({ id: "r", projectId: "p1", description: "Live", startAt: new Date(2026, 9, 5, 11, 0).toISOString(), endAt: undefined, minutes: 0 });
    const { days } = buildWeek("2026-10-05", [], { ...ctx, projects: [hourly], running });
    expect(days[0]!.blocks).toHaveLength(1);
    expect(days[0]!.blocks[0]).toMatchObject({ id: "__running", state: "live", startMin: 660, minutes: 60, description: "Live" });
  });

  it("shows no live block when nothing runs", () => {
    expect(buildWeek("2026-10-05", [], ctx).days.every((d) => d.blocks.length === 0)).toBe(true);
  });
});

describe("rangeFor", () => {
  it("extends the axis so a running block past 20:00 is not clipped", () => {
    const days = [{ date: "d", minutes: 0, blocks: [{ startMin: 19 * 60, endMin: 20 * 60 + 40 }] }] as never;
    expect(rangeFor(days).end).toBe(21);
    expect(rangeFor(days, 21 * 60 + 5).end).toBe(22);
  });
});
