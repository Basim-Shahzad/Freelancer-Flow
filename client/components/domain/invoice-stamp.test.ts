import { describe, expect, it } from "vitest";
import type { InvoiceStatus } from "@/lib/types";
import { STAMP_CLASS, stampFor } from "./invoice-stamp";

describe("stampFor", () => {
  it("maps every display status to a word", () => {
    const words: Record<InvoiceStatus, string> = { draft: "Draft", unpaid: "Sent", partial: "Part-paid", paid: "Paid", overdue: "Overdue", written_off: "Written off", void: "Void" };
    for (const [s, w] of Object.entries(words)) expect(stampFor(s as InvoiceStatus).label).toBe(w);
  });
  it("uses gold only for paid", () => {
    const all: InvoiceStatus[] = ["draft", "unpaid", "partial", "paid", "overdue", "written_off", "void"];
    expect(all.filter((s) => stampFor(s).tone === "gold")).toEqual(["paid"]);
    expect(STAMP_CLASS.gold).toContain("accent");
    expect(Object.entries(STAMP_CLASS).filter(([k, v]) => k !== "gold" && v.includes("accent"))).toEqual([]);
  });
  it("uses error tone for overdue and a dashed outline for draft", () => {
    expect(stampFor("overdue").tone).toBe("error");
    expect(STAMP_CLASS.draft).toContain("border-dashed");
  });
});
