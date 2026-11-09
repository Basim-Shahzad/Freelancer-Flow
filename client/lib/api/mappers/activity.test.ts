import { describe, expect, it } from "vitest";
import { activityHref, describeChanges, toActivityParams } from "./activity";

describe("toActivityParams", () => {
  const now = new Date(2026, 10, 10, 15, 30);
  it("omits everything for all/all", () => expect(toActivityParams({ segment: "all", range: "all" }, now)).toEqual({}));
  it("maps segment and range", () => {
    const p = toActivityParams({ segment: "time_entry", range: "7" }, now);
    expect(p.entity_type).toBe("time_entry");
    expect(new Date(p.from!).getTime()).toBe(new Date(2026, 10, 4).getTime());
  });
});

describe("activityHref", () => {
  it("routes entities", () => {
    expect(activityHref("invoice", "i1")).toBe("/invoices/i1");
    expect(activityHref("project", "p1")).toBe("/projects/p1");
    expect(activityHref("client", "c1")).toBe("/clients/c1");
    expect(activityHref("time_entry", "t1")).toBe("/time");
    expect(activityHref("other", "x")).toBe("/settings/activity");
  });
});

describe("describeChanges", () => {
  it("never prints redacted values", () => {
    const out = describeChanges({ tax_id: { old: "[redacted]", new: "[redacted]" }, status: { old: "draft", new: "sent" } });
    expect(out).toEqual(["Tax id changed", "Status: draft → sent"]);
    expect(out.join()).not.toContain("redacted");
  });
  it("handles null", () => expect(describeChanges(null)).toEqual([]));
});
