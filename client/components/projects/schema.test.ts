import { describe, expect, it } from "vitest";
import { responseToProject } from "@/lib/api/mappers/projects";
import { projectResponseFixture } from "@/lib/test/projects";
import { emptyProjectForm, formToProject, projectSchema, projectToForm, type ProjectFormValues } from "./schema";

const form = (over: Partial<ProjectFormValues> = {}): ProjectFormValues => ({
  name: "Brand site", clientId: "c1", description: "", currency: "USD", status: "active", billingType: "fixed", budget: "120,000",
  hourlyRate: "", retainerAmount: "", retainerInterval: "monthly", retainerStartDate: "", retainerEndDate: "", dueDate: "", milestonesEnabled: false, ...over,
});
const issues = (v: ProjectFormValues) => { const r = projectSchema.safeParse(v); return r.success ? [] : r.error.issues.map((i) => i.path.join(".")); };

describe("projectSchema (discriminated union)", () => {
  it("accepts a valid fixed project", () => expect(issues(form())).toEqual([]));

  it("requires a price for FIXED only", () => {
    expect(issues(form({ budget: "" }))).toEqual(["budget"]);
    expect(issues(form({ budget: "0" }))).toEqual(["budget"]);
    expect(issues(form({ billingType: "milestone", budget: "" }))).toEqual([]);
  });

  it("HOURLY rate is optional, but must be positive when given", () => {
    expect(issues(form({ billingType: "hourly", budget: "", hourlyRate: "" }))).toEqual([]);
    expect(issues(form({ billingType: "hourly", budget: "", hourlyRate: "45.00" }))).toEqual([]);
    expect(issues(form({ billingType: "hourly", budget: "", hourlyRate: "0" }))).toEqual(["hourlyRate"]);
  });

  it("RETAINER requires an amount and an interval", () => {
    expect(issues(form({ billingType: "retainer", budget: "" }))).toEqual(["retainerAmount"]);
    expect(issues(form({ billingType: "retainer", retainerAmount: "1,300", retainerInterval: "" }))).toEqual(["retainerInterval"]);
    expect(issues(form({ billingType: "retainer", retainerAmount: "1,300", retainerInterval: "quarterly" }))).toEqual([]);
  });

  it("rejects a YEARLY retainer interval, which the server does not accept", () => {
    expect(issues(form({ billingType: "retainer", retainerAmount: "1,300", retainerInterval: "yearly" as never }))).toEqual(["retainerInterval"]);
  });

  it("the retainer end date must be after the start date", () => {
    const ok = { billingType: "retainer" as const, retainerAmount: "1,300", retainerStartDate: "2026-09-01" };
    expect(issues(form({ ...ok, retainerEndDate: "2026-09-01" }))).toEqual(["retainerEndDate"]);
    expect(issues(form({ ...ok, retainerEndDate: "2027-09-01" }))).toEqual([]);
    expect(issues(form({ ...ok, retainerEndDate: "" }))).toEqual([]);
  });

  it("validates the common fields", () => {
    expect(issues(form({ name: " ", clientId: "" })).sort()).toEqual(["clientId", "name"]);
  });
});

describe("formToProject", () => {
  it("parses amounts into minor units and drops fields of other billing types", () => {
    expect(formToProject(form({ budget: "1,200.50", hourlyRate: "45", retainerAmount: "9" }))).toMatchObject({
      billingType: "fixed", budget: 120050, hourlyRate: undefined, retainerAmount: undefined, retainerInterval: undefined,
    });
    expect(formToProject(form({ billingType: "hourly", hourlyRate: "45.50" }))).toMatchObject({ hourlyRate: 4550, budget: undefined });
    expect(formToProject(form({ billingType: "hourly", hourlyRate: "" })).hourlyRate).toBeUndefined();
  });

  it("keeps the retainer fields and forces milestones on for MILESTONE projects", () => {
    expect(formToProject(form({ billingType: "retainer", retainerAmount: "1,300", retainerInterval: "quarterly", retainerStartDate: "2026-09-01", retainerEndDate: "2027-09-01" }))).toMatchObject({
      retainerAmount: 130000, retainerInterval: "quarterly", retainerStartDate: "2026-09-01", retainerEndDate: "2027-09-01",
    });
    expect(formToProject(form({ billingType: "milestone", milestonesEnabled: false })).milestonesEnabled).toBe(true);
  });

  it("round-trips an API project through the form", () => {
    const p = responseToProject(projectResponseFixture({
      billingType: "RETAINER", hourlyRate: null, retainerAmount: "1300.00", retainerInterval: "MONTHLY", retainerStartDate: "2026-09-01", dueDate: "2026-11-01T00:00:00Z",
    }));
    const back = projectToForm(p);
    expect(back).toMatchObject({ retainerAmount: "1300.00", retainerInterval: "monthly", retainerStartDate: "2026-09-01", dueDate: "2026-11-01", hourlyRate: "" });
    expect(formToProject(back)).toMatchObject({ retainerAmount: 130000, dueDate: "2026-11-01" });
  });

  it("starts empty with the client's currency", () => {
    const clients = [{ id: "c1", currency: "PKR" }] as never;
    expect(emptyProjectForm(clients, "USD", "c1")).toMatchObject({ clientId: "c1", currency: "PKR", billingType: "fixed" });
    expect(emptyProjectForm(clients, "USD")).toMatchObject({ clientId: "", currency: "USD" });
  });
});
