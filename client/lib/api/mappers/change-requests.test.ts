import { describe, expect, it } from "vitest";
import { changeRequestFixture, changeRequestResponseFixture } from "@/lib/test/change-requests";
import { changeRequestToCreate, changeRequestToInput, changeRequestToUpdate, decisionToUpdate, responseToChangeRequest } from "./change-requests";

describe("responseToChangeRequest", () => {
  it("maps nulls to absent fields and lowercases the status", () => {
    const c = responseToChangeRequest(changeRequestResponseFixture(), "USD");
    expect(c).toMatchObject({ status: "pending", description: "", estimatedHours: undefined, estimatedAmount: undefined, decidedAt: undefined, decisionNote: undefined });
  });

  it("converts money by the project currency and hours to a number", () => {
    const r = changeRequestResponseFixture({ estimatedAmount: "1250.50", estimatedHours: "6.50", status: "APPROVED", decisionNote: "ok" });
    expect(responseToChangeRequest(r, "USD")).toMatchObject({ estimatedAmount: 125050, estimatedHours: 6.5, status: "approved", decisionNote: "ok" });
    expect(responseToChangeRequest(changeRequestResponseFixture({ estimatedAmount: "5000" }), "PKR").estimatedAmount).toBe(5000);
  });
});

describe("requests", () => {
  const input = { title: " Extra page ", description: "  ", estimatedHours: 2, estimatedAmount: 10000 };

  it("builds a create body with trimmed text, null blanks and wire decimals", () => {
    expect(changeRequestToCreate("p1", input, "USD")).toEqual({ projectId: "p1", title: "Extra page", description: null, estimatedHours: "2.00", estimatedAmount: "100.00" });
    expect(changeRequestToCreate("p1", { title: "A", description: "" }, "USD")).toMatchObject({ estimatedHours: null, estimatedAmount: null });
  });

  it("sends only the changed fields, nulling cleared ones", () => {
    const prev = changeRequestToInput(changeRequestFixture({ description: "x", estimatedAmount: 500 }));
    expect(changeRequestToUpdate({ ...prev }, prev, "USD")).toEqual({});
    expect(changeRequestToUpdate({ ...prev, title: "New", estimatedAmount: undefined }, prev, "USD")).toEqual({ title: "New", estimatedAmount: null });
  });

  it("builds decision bodies, omitting a blank note", () => {
    expect(decisionToUpdate("approved")).toEqual({ status: "APPROVED" });
    expect(decisionToUpdate("rejected", "  ")).toEqual({ status: "REJECTED" });
    expect(decisionToUpdate("withdrawn", " changed my mind ")).toEqual({ status: "WITHDRAWN", decisionNote: "changed my mind" });
  });
});
