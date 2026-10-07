import { describe, expect, it } from "vitest";
import type { Project } from "@/lib/types";
import { emptyRow, formToProject, milestoneSum, projectSchema, projectToForm, type ProjectFormValues } from "./schema";

const form = (over: Partial<ProjectFormValues> = {}): ProjectFormValues => ({
  name: "Brand site", clientId: "c1", currency: "PKR", status: "active", startDate: "2026-10-01", billingType: "fixed",
  fixedAmount: "120,000", hourlyRate: "", retainerAmount: "", retainerHours: "", progress: "", notes: "", milestones: [], ...over,
});
const issues = (v: ProjectFormValues) => { const r = projectSchema.safeParse(v); return r.success ? [] : r.error.issues.map((i) => i.path.join(".")); };

describe("projectSchema (discriminated union)", () => {
  it("accepts a valid fixed project", () => expect(issues(form())).toEqual([]));
  it("requires only the fields for the chosen type", () => {
    expect(issues(form({ billingType: "hourly", fixedAmount: "" }))).toEqual(["hourlyRate"]);
    expect(issues(form({ billingType: "hourly", hourlyRate: "45.00", fixedAmount: "" }))).toEqual([]);
    expect(issues(form({ billingType: "retainer", fixedAmount: "" }))).toEqual(["retainerAmount"]);
    expect(issues(form({ billingType: "fixed", fixedAmount: "0" }))).toEqual(["fixedAmount"]);
  });
  it("milestone projects need at least one valid milestone", () => {
    expect(issues(form({ billingType: "milestone", fixedAmount: "" }))).toEqual(["milestones"]);
    expect(issues(form({ billingType: "milestone", milestones: [emptyRow()] })).sort()).toEqual(["milestones.0.amount", "milestones.0.dueDate", "milestones.0.title"]);
    expect(issues(form({ billingType: "milestone", milestones: [{ mid: "a", title: "Design", amount: "5,000", dueDate: "2026-11-01" }] }))).toEqual([]);
  });
  it("validates common fields", () => {
    expect(issues(form({ name: " ", clientId: "", progress: "150" })).sort()).toEqual(["clientId", "name", "progress"]);
  });
  it("validates retainer hours", () => {
    expect(issues(form({ billingType: "retainer", retainerAmount: "1,300", retainerHours: "abc" }))).toEqual(["retainerHours"]);
  });
});

describe("formToProject", () => {
  it("parses amounts into minor units and drops unrelated fields", () => {
    const p = formToProject(form({ fixedAmount: "120,000", hourlyRate: "45" }));
    expect(p).toMatchObject({ billingType: "fixed", fixedAmount: 12000000, hourlyRate: undefined, retainerAmount: undefined });
    expect(formToProject(form({ billingType: "hourly", hourlyRate: "45.50", currency: "USD" })).hourlyRate).toBe(4550);
  });
  it("builds milestones, keeping state of existing ones", () => {
    const existing = { id: "p", shareToken: "t", milestones: [{ id: "keep", title: "Old", description: "d", amount: 1, dueDate: "2026-09-01", status: "approved", invoiceId: "inv" }], retainerPeriods: [] } as unknown as Project;
    const p = formToProject(form({ billingType: "milestone", milestones: [{ mid: "keep", title: "Renamed", amount: "900.50", dueDate: "2026-09-02" }, { mid: "new", title: "Build", amount: "1,000", dueDate: "2026-10-30" }] }), existing);
    expect(p.milestones[0]).toMatchObject({ id: "keep", title: "Renamed", amount: 90050, status: "approved", invoiceId: "inv", description: "d" });
    expect(p.milestones[1]).toMatchObject({ id: "new", amount: 100000, status: "upcoming" });
  });
  it("generates retainer periods on create and only reprices uninvoiced ones on edit", () => {
    const created = formToProject(form({ billingType: "retainer", retainerAmount: "1,300", retainerHours: "12", currency: "USD", startDate: "2026-09-10" }), undefined, "2026-10-05");
    expect(created.retainerPeriods.map((r) => r.label)).toEqual(["Sep 2026", "Oct 2026"]);
    expect(created).toMatchObject({ retainerAmount: 130000, retainerHours: 12 });
    const existing = { ...created, id: "p", shareToken: "t", retainerPeriods: [{ ...created.retainerPeriods[0]!, invoiceId: "i" }, created.retainerPeriods[1]!] } as Project;
    const edited = formToProject(form({ billingType: "retainer", retainerAmount: "1,500", currency: "USD" }), existing);
    expect(edited.retainerPeriods.map((r) => r.amount)).toEqual([130000, 150000]);
  });
  it("round-trips through the form", () => {
    const p = { id: "p", shareToken: "t", ...formToProject(form({ billingType: "milestone", currency: "USD", milestones: [{ mid: "a", title: "X", amount: "1,250.5", dueDate: "2026-11-01" }] })) } as Project;
    const back = projectToForm(p);
    expect(back.milestones[0]?.amount).toBe("1250.50");
    expect(formToProject(back, p).milestones[0]?.amount).toBe(125050);
  });
  it("sums milestone rows", () => {
    expect(milestoneSum([{ mid: "a", title: "", amount: "1,000", dueDate: "" }, { mid: "b", title: "", amount: "x", dueDate: "" }])).toBe(100000);
  });
});
