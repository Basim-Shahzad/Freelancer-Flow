import { describe, expect, it } from "vitest";
import { AMOUNT_TAGS, countLine, STATUS_FILTERS } from "./list-logic";

describe("invoice list logic", () => {
  it("counts invoices and overdue", () => {
    expect(countLine(10, 1)).toBe("10 invoices · 1 overdue");
    expect(countLine(1)).toBe("1 invoice");
    expect(countLine(0, 0)).toBe("0 invoices");
  });
  it("offers every status, with 'Unpaid' standing for sent and partial", () => {
    expect(STATUS_FILTERS.map((f) => f.value)).toEqual(["all", "draft", "unpaid", "overdue", "paid", "written_off", "void"]);
  });
  it("tags the amounts that are not the plain total", () => {
    expect(AMOUNT_TAGS).toEqual({ partial: "balance", written_off: "written off", void: "cancelled" });
  });
});
