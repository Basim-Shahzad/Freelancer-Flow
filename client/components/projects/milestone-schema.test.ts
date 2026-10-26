import { describe, expect, it } from "vitest";
import { milestoneFixture } from "@/lib/test/projects";
import { emptyMilestoneForm, formToMilestone, milestoneSchema, milestoneToForm } from "./milestone-schema";

const issues = (v: ReturnType<typeof emptyMilestoneForm>) => { const r = milestoneSchema.safeParse(v); return r.success ? [] : r.error.issues.map((i) => i.path.join(".")); };

describe("milestoneSchema", () => {
  it("only needs a name", () => {
    expect(issues(emptyMilestoneForm())).toEqual(["title"]);
    expect(issues({ ...emptyMilestoneForm(), title: "Design" })).toEqual([]);
  });
  it("rejects a zero or malformed amount but allows a blank one", () => {
    expect(issues({ ...emptyMilestoneForm(), title: "x", amount: "0" })).toEqual(["amount"]);
    expect(issues({ ...emptyMilestoneForm(), title: "x", amount: "abc" })).toEqual(["amount"]);
    expect(issues({ ...emptyMilestoneForm(), title: "x", amount: "1,250.50" })).toEqual([]);
  });
});

describe("milestone form conversions", () => {
  it("parses the amount into minor units and drops blanks", () => {
    expect(formToMilestone({ title: " Build ", description: "", amount: "1,250.5", dueDate: "2026-11-01", approvalRequired: true })).toEqual({
      title: "Build", description: "", amount: 125050, dueDate: "2026-11-01", approvalRequired: true,
    });
    expect(formToMilestone(emptyMilestoneForm())).toMatchObject({ amount: undefined, dueDate: undefined });
  });
  it("round-trips a milestone", () => {
    const m = milestoneFixture({ title: "Design", amount: 125050, dueDate: "2026-11-01", approvalRequired: true });
    const form = milestoneToForm(m, "USD");
    expect(form).toMatchObject({ title: "Design", amount: "1250.50", dueDate: "2026-11-01", approvalRequired: true });
    expect(formToMilestone(form).amount).toBe(125050);
  });
});
