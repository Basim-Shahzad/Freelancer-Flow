import { describe, expect, it } from "vitest";
import type { TimeEntry } from "@/lib/types";
import { rangeFor } from "./week-grid";
import { buildWeek } from "./week-model";

const entry = (o: Partial<TimeEntry> & { id: string }): TimeEntry => ({ description: "x", date: "2026-10-05", minutes: 60, billable: true, updatedAt: "2026-10-05T10:00:00.000Z", ...o });
const ctx = { projects: [], clients: [], invoices: [], timer: { running: false, description: "" }, nowMs: new Date(2026, 9, 5, 12, 0).getTime(), today: "2026-10-05" };

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

describe("rangeFor", () => {
  it("extends the axis so a running block past 20:00 is not clipped", () => {
    const days = [{ date: "d", minutes: 0, blocks: [{ startMin: 19 * 60, endMin: 20 * 60 + 40 }] }] as never;
    expect(rangeFor(days).end).toBe(21);
    expect(rangeFor(days, 21 * 60 + 5).end).toBe(22);
  });
});
