import { describe, expect, it } from "vitest";
import { milestoneResponseFixture, periodResponseFixture, projectResponseFixture } from "@/lib/test/projects";
import {
  milestoneStatusFromApi, milestoneStatusToApi, milestoneToCreate, milestoneToInput, milestoneToUpdate, moveItem, responseToMilestone,
} from "./milestones";
import { projectToCreate, projectToInput, projectToUpdate, responseToPeriod, responseToProject, type ProjectInput } from "./projects";

const input = (over: Partial<ProjectInput> = {}): ProjectInput => ({
  name: "Brand site", clientId: "c1", description: "", billingType: "fixed", currency: "USD", status: "active", milestonesEnabled: false, ...over,
});

describe("responseToProject", () => {
  it("maps an hourly project", () => {
    const p = responseToProject(projectResponseFixture({ hourlyRate: "45.50", totalTimeSpentMinutes: 90 }));
    expect(p).toMatchObject({
      id: "p1", clientId: "c1", client: { id: "c1", name: "Harbor Labs" }, billingType: "hourly", status: "active", currency: "USD",
      hourlyRate: 4550, totalTimeSpentMinutes: 90, milestonesEnabled: false,
    });
    expect(p.budget).toBeUndefined();
  });

  it("maps a fixed project's price from the budget", () => {
    const p = responseToProject(projectResponseFixture({ billingType: "FIXED", budget: "120000.00", hourlyRate: null, currency: "PKR", dueDate: "2026-11-01T00:00:00Z" }));
    // PKR has no minor unit in this app (see lib/money.ts), so the decimal string is the minor amount.
    expect(p).toMatchObject({ billingType: "fixed", currency: "PKR", budget: 120000, dueDate: "2026-11-01" });
  });

  it("maps a retainer project", () => {
    const p = responseToProject(projectResponseFixture({
      billingType: "RETAINER", hourlyRate: null, retainerAmount: "1300.00", retainerInterval: "QUARTERLY",
      retainerStartDate: "2026-09-01", retainerEndDate: "2027-09-01",
    }));
    expect(p).toMatchObject({ billingType: "retainer", retainerAmount: 130000, retainerInterval: "quarterly", retainerStartDate: "2026-09-01", retainerEndDate: "2027-09-01" });
  });

  it("forces milestones on for a MILESTONE project and keeps the other statuses", () => {
    const p = responseToProject(projectResponseFixture({ billingType: "MILESTONE", milestonesEnabled: false, status: "ARCHIVED" }));
    expect(p).toMatchObject({ billingType: "milestone", milestonesEnabled: true, status: "archived" });
  });

  it("keeps a null progressPercent null and a number as is", () => {
    expect(responseToProject(projectResponseFixture({ progressPercent: null })).progressPercent).toBeNull();
    expect(responseToProject(projectResponseFixture({ progressPercent: 0 })).progressPercent).toBe(0);
    expect(responseToProject(projectResponseFixture({ progressPercent: 60 })).progressPercent).toBe(60);
  });

  it("falls back for an unknown or missing currency", () => {
    expect(responseToProject(projectResponseFixture({ currency: null }), "PKR").currency).toBe("PKR");
  });
});

describe("projectToCreate", () => {
  it("sends only the fixed price for FIXED", () => {
    expect(projectToCreate(input({ budget: 36000, currency: "USD", hourlyRate: 100, retainerAmount: 5 }))).toMatchObject({
      billingType: "FIXED", budget: "360.00", hourlyRate: null, retainerAmount: null, retainerInterval: null, currency: "USD", status: "ACTIVE",
    });
  });

  it("sends only the rate for HOURLY", () => {
    expect(projectToCreate(input({ billingType: "hourly", hourlyRate: 4550, budget: 1 }))).toMatchObject({ billingType: "HOURLY", hourlyRate: "45.50", budget: null });
  });

  it("sends the retainer fields for RETAINER", () => {
    const body = projectToCreate(input({
      billingType: "retainer", retainerAmount: 130000, retainerInterval: "monthly", retainerStartDate: "2026-09-01", retainerEndDate: "2027-09-01", hourlyRate: 1,
    }));
    expect(body).toMatchObject({
      billingType: "RETAINER", retainerAmount: "1300.00", retainerInterval: "MONTHLY", retainerStartDate: "2026-09-01", retainerEndDate: "2027-09-01", hourlyRate: null,
    });
  });

  it("leaves retainer fields null when missing, so the server answers 422", () => {
    expect(projectToCreate(input({ billingType: "retainer" }))).toMatchObject({ billingType: "RETAINER", retainerAmount: null, retainerInterval: null });
  });

  it("always enables milestones for MILESTONE and honours the switch otherwise", () => {
    expect(projectToCreate(input({ billingType: "milestone" })).milestonesEnabled).toBe(true);
    expect(projectToCreate(input({ billingType: "fixed", milestonesEnabled: true })).milestonesEnabled).toBe(true);
    expect(projectToCreate(input({ billingType: "fixed" })).milestonesEnabled).toBe(false);
  });

  it("turns the due date into a UTC timestamp that maps back to the same day", () => {
    const body = projectToCreate(input({ dueDate: "2026-11-01" }));
    expect(body.dueDate).toBe("2026-11-01T00:00:00Z");
    expect(responseToProject(projectResponseFixture({ dueDate: body.dueDate ?? null })).dueDate).toBe("2026-11-01");
  });

  it("trims the name and turns a blank description into null", () => {
    expect(projectToCreate(input({ name: "  Site  ", description: "  " }))).toMatchObject({ name: "Site", description: null });
  });
});

describe("projectToUpdate", () => {
  const before = input({ budget: 100000 });

  it("sends only what changed", () => {
    expect(projectToUpdate({ ...before, name: "Renamed" }, before)).toEqual({ name: "Renamed" });
    expect(projectToUpdate(before, before)).toEqual({});
  });

  it("clears the old type's fields when the billing type changes", () => {
    expect(projectToUpdate({ ...before, billingType: "hourly", hourlyRate: 4500, budget: 100000 }, before)).toEqual({ billingType: "HOURLY", hourlyRate: "45.00", budget: null });
  });

  it("round-trips a response through the form input without changes", () => {
    const p = responseToProject(projectResponseFixture({ hourlyRate: "45.00" }));
    expect(projectToUpdate(projectToInput(p), projectToInput(p))).toEqual({});
  });

  it("clears the due date with null", () => {
    expect(projectToUpdate(input({ dueDate: undefined }), input({ dueDate: "2026-11-01" }))).toEqual({ dueDate: null });
  });
});

describe("responseToPeriod", () => {
  it("keys the period by its start and marks invoiced ones", () => {
    expect(responseToPeriod(periodResponseFixture(), 130000)).toEqual({ id: "2026-10-01", label: "Oct 2026", start: "2026-10-01", end: "2026-10-31", amount: 130000, invoiceId: undefined });
    expect(responseToPeriod(periodResponseFixture({ invoiceId: "inv1" }), 130000).invoiceId).toBe("inv1");
  });
});

describe("milestones", () => {
  it("maps statuses both ways", () => {
    expect(milestoneStatusFromApi("IN_PROGRESS")).toBe("in_progress");
    expect(milestoneStatusToApi("rejected")).toBe("REJECTED");
  });

  it("maps a response, with and without money", () => {
    const m = responseToMilestone(milestoneResponseFixture({ amount: "1250.50", dueDate: "2026-11-01T00:00:00Z", approvalRequired: true, status: "SUBMITTED", submittedAt: "2026-10-01T10:00:00Z" }), "USD");
    expect(m).toMatchObject({ title: "Design", amount: 125050, dueDate: "2026-11-01", approvalRequired: true, status: "submitted", submittedAt: "2026-10-01T10:00:00Z" });
    expect(responseToMilestone(milestoneResponseFixture(), "USD")).toMatchObject({ amount: undefined, dueDate: undefined, description: "" });
  });

  it("builds a create body", () => {
    expect(milestoneToCreate("p1", { title: " Design ", description: "", amount: 125050, dueDate: "2026-11-01", approvalRequired: false }, "USD")).toEqual({
      projectId: "p1", name: "Design", description: null, amount: "1250.50", dueDate: "2026-11-01T00:00:00Z", approvalRequired: false,
    });
  });

  it("builds a minimal update body", () => {
    const prev = milestoneToInput(responseToMilestone(milestoneResponseFixture({ amount: "10.00" }), "USD"));
    expect(milestoneToUpdate({ ...prev, title: "Build" }, prev, "USD")).toEqual({ name: "Build" });
    expect(milestoneToUpdate({ ...prev, amount: undefined }, prev, "USD")).toEqual({ amount: null });
  });
});

describe("moveItem", () => {
  it("moves without mutating and ignores out-of-range moves", () => {
    const a = ["a", "b", "c"];
    expect(moveItem(a, 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(a, 2, 1)).toEqual(["a", "c", "b"]);
    expect(moveItem(a, 0, 3)).toEqual(a);
    expect(a).toEqual(["a", "b", "c"]);
  });
});
