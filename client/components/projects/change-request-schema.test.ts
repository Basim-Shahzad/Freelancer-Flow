import { describe, expect, it } from "vitest";
import { changeRequestFixture } from "@/lib/test/change-requests";
import { changeRequestSchema, changeRequestToForm, emptyChangeRequestForm, formToChangeRequestInput } from "./change-request-schema";

const issues = (v: ReturnType<typeof emptyChangeRequestForm>) => { const r = changeRequestSchema.safeParse(v); return r.success ? [] : r.error.issues.map((i) => i.path.join(".")); };

describe("changeRequestSchema", () => {
  it("only needs a title", () => {
    expect(issues(emptyChangeRequestForm())).toEqual(["title"]);
    expect(issues({ ...emptyChangeRequestForm(), title: "Extra page" })).toEqual([]);
  });
  it("validates hours and amount but allows blanks", () => {
    const base = { ...emptyChangeRequestForm(), title: "x" };
    expect(issues({ ...base, estimatedHours: "1.5" })).toEqual([]);
    expect(issues({ ...base, estimatedHours: "1.555" })).toEqual(["estimatedHours"]);
    expect(issues({ ...base, estimatedHours: "-2" })).toEqual(["estimatedHours"]);
    expect(issues({ ...base, estimatedAmount: "0" })).toEqual(["estimatedAmount"]);
    expect(issues({ ...base, estimatedAmount: "1,250.50" })).toEqual([]);
  });
});

describe("conversions", () => {
  it("parses into minor units and drops blanks", () => {
    expect(formToChangeRequestInput({ title: " A ", description: " d ", estimatedHours: "2.5", estimatedAmount: "1,250.5" })).toEqual({
      title: "A", description: "d", estimatedHours: 2.5, estimatedAmount: 125050,
    });
    expect(formToChangeRequestInput(emptyChangeRequestForm())).toMatchObject({ estimatedHours: undefined, estimatedAmount: undefined });
  });
  it("round-trips a change request into the form", () => {
    expect(changeRequestToForm(changeRequestFixture({ estimatedHours: 3, estimatedAmount: 125050 }), "USD")).toMatchObject({ estimatedHours: "3", estimatedAmount: "1250.50" });
  });
});
