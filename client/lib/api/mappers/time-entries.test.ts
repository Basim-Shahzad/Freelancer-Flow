import { describe, expect, it } from "vitest";
import { runningEntryFixture, timeEntryResponseFixture } from "@/lib/test/time-entries";
import {
  addMinutesIso, bulkToWire, entryToInput, inputToCreate, inputToStart, inputToUpdate, localToUtc, responseToTimeEntry, toSyncItem,
} from "./time-entries";

describe("responseToTimeEntry", () => {
  it("derives the local day, HH:MM and minutes from the UTC timestamps", () => {
    const start = new Date(2026, 9, 5, 23, 30);
    const r = timeEntryResponseFixture({ startTime: start.toISOString(), endTime: new Date(2026, 9, 6, 0, 15).toISOString(), durationMinutes: 45 });
    const e = responseToTimeEntry(r);
    expect(e.date).toBe("2026-10-05");
    expect(e.startTime).toBe("23:30");
    expect(e.minutes).toBe(45);
    expect(e.startAt).toBe(r.startTime);
    expect(e.endAt).toBe(r.endTime);
  });

  it("maps a running entry (no end, zero minutes)", () => {
    const e = responseToTimeEntry(runningEntryFixture({ durationMinutes: 17 }));
    expect(e.endAt).toBeUndefined();
    expect(e.minutes).toBe(0);
  });

  it("carries the billable and invoiced flags and the milestone", () => {
    const e = responseToTimeEntry(timeEntryResponseFixture({ isInvoiced: true, isBillable: false, milestoneId: "m1" }));
    expect(e).toMatchObject({ isInvoiced: true, billable: false, milestoneId: "m1" });
  });

  it("converts the rate decimal into minor units of the project currency", () => {
    const r = timeEntryResponseFixture({ hourlyRate: "45.50" });
    expect(responseToTimeEntry(r, () => "USD").hourlyRate).toBe(4550);
    expect(responseToTimeEntry(r, () => "PKR").hourlyRate).toBe(46); // PKR has no minor unit: rounded half up
    expect(responseToTimeEntry(r).hourlyRate).toBeUndefined();
    expect(responseToTimeEntry(timeEntryResponseFixture(), () => "USD").hourlyRate).toBeUndefined();
  });
});

describe("request bodies", () => {
  const input = { description: "  Work  ", projectId: "p1", milestoneId: "", date: "2026-10-05", startTime: "09:30", minutes: 90, billable: true };

  it("builds a create body with UTC start and end", () => {
    const body = inputToCreate(input);
    expect(body).toEqual({
      description: "Work", projectId: "p1", milestoneId: null, isBillable: true,
      startTime: new Date(2026, 9, 5, 9, 30).toISOString(), endTime: new Date(2026, 9, 5, 11, 0).toISOString(),
    });
  });

  it("builds an update body without the project and clears the milestone with null", () => {
    const body = inputToUpdate({ ...input, milestoneId: "" });
    expect(body).not.toHaveProperty("projectId");
    expect(body.milestoneId).toBeNull();
    expect(inputToUpdate({ ...input, milestoneId: "m1" }).milestoneId).toBe("m1");
  });

  it("round-trips an entry through the form input", () => {
    const e = responseToTimeEntry(timeEntryResponseFixture({ startTime: new Date(2026, 9, 5, 9, 30).toISOString(), durationMinutes: 90 }));
    expect(entryToInput(e)).toMatchObject({ date: "2026-10-05", startTime: "09:30", minutes: 90, projectId: "p1", milestoneId: "" });
  });

  it("builds a start body, with a rate as a decimal string only when given", () => {
    expect(inputToStart({ description: " x ", projectId: "p1" })).toEqual({ description: "x", projectId: "p1", milestoneId: null, isBillable: true });
    expect(inputToStart({ description: "x", projectId: "p1", rate: 4550, currency: "USD", startAt: "2026-10-05T09:00:00.000Z" })).toMatchObject({
      hourlyRate: "45.50", startTime: "2026-10-05T09:00:00.000Z",
    });
  });

  it("sends only the bulk fields that are set", () => {
    expect(bulkToWire({ billable: false })).toEqual({ isBillable: false });
    expect(bulkToWire({ projectId: "p2", milestoneId: null, description: " hi " })).toEqual({ projectId: "p2", milestoneId: null, description: "hi" });
  });

  it("builds sync items", () => {
    expect(toSyncItem({ id: "a", projectId: "p1", description: "d", startAt: "s", billable: true })).toEqual({
      id: "a", projectId: "p1", milestoneId: null, description: "d", startTime: "s", endTime: null, isBillable: true, updatedAt: null, deleted: false,
    });
    expect(toSyncItem({ id: "a", projectId: "p1", description: "d", startAt: "s", endAt: "e", billable: false, seenUpdatedAt: "u", deleted: true })).toMatchObject({
      endTime: "e", updatedAt: "u", deleted: true, isBillable: false,
    });
  });

  it("converts local date and time to UTC and adds minutes", () => {
    expect(localToUtc("2026-10-05", "09:30")).toBe(new Date(2026, 9, 5, 9, 30).toISOString());
    expect(addMinutesIso("2026-10-05T09:00:00.000Z", 90)).toBe("2026-10-05T10:30:00.000Z");
  });
});
