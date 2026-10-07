import { describe, expect, it } from "vitest";
import type { ActivityEntry } from "@/lib/types";
import { DEFAULT_FILTER, filterActivity, isFiltered } from "./activity-filter";

const NOW = new Date("2026-10-05T12:00:00");
const e = (id: string, at: string, type: ActivityEntry["type"], action = "Did a thing", record = "INV-0001", detail = ""): ActivityEntry => ({ id, at, type, action, record, detail });
const data = [
  e("1", "2026-09-20T10:00:00", "invoice", "Invoice created", "INV-0030"),
  e("2", "2026-10-05T08:20:00", "invoice", "Status changed to paid", "INV-0041", "Payment USD 1,980.00"),
  e("3", "2026-10-04T16:31:00", "payment", "Payment recorded", "INV-0044", "PKR 30,000 · Raast"),
  e("4", "2026-10-02T18:40:00", "project", "Milestone approved by client", "Brand site"),
  e("5", "2026-09-30T12:02:00", "settings", "Payment method reordered", "Settings"),
  e("6", "2026-10-03T09:00:00", "client", "Client added", "Dua Studio"),
  e("7", "2026-10-01T09:00:00", "time", "Time logged", "Mobile app"),
];
const f = (over: Partial<typeof DEFAULT_FILTER>) => ({ ...DEFAULT_FILTER, ...over });
const ids = (xs: ActivityEntry[]) => xs.map((x) => x.id);

describe("filterActivity", () => {
  it("sorts newest first and includes client/time under All", () => {
    expect(ids(filterActivity(data, f({ range: "all" }), NOW))).toEqual(["2", "3", "6", "4", "7", "5", "1"]);
  });
  it("filters by segment", () => {
    expect(ids(filterActivity(data, f({ segment: "payment", range: "all" }), NOW))).toEqual(["3"]);
    expect(ids(filterActivity(data, f({ segment: "settings", range: "all" }), NOW))).toEqual(["5"]);
    expect(ids(filterActivity(data, f({ segment: "invoice", range: "all" }), NOW))).toEqual(["2", "1"]);
  });
  it("applies the 7 and 30 day ranges in calendar days", () => {
    expect(ids(filterActivity(data, f({ range: "7" }), NOW))).toEqual(["2", "3", "6", "4", "7", "5"]);
    expect(ids(filterActivity(data, f({ range: "30" }), NOW))).toEqual(["2", "3", "6", "4", "7", "5", "1"]);
  });
  it("searches action, record and detail case-insensitively", () => {
    expect(ids(filterActivity(data, f({ range: "all", query: "inv-0044" }), NOW))).toEqual(["3"]);
    expect(ids(filterActivity(data, f({ range: "all", query: "RAAST" }), NOW))).toEqual(["3"]);
    expect(ids(filterActivity(data, f({ range: "all", query: "zzz" }), NOW))).toEqual([]);
  });
  it("does not mutate the input", () => {
    const copy = [...data];
    filterActivity(data, f({ range: "all" }), NOW);
    expect(data).toEqual(copy);
  });
  it("knows when filters are active", () => {
    expect(isFiltered(DEFAULT_FILTER)).toBe(false);
    expect(isFiltered(f({ query: "x" }))).toBe(true);
  });
});
