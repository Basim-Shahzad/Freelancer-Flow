import { describe, expect, it } from "vitest";
import { seedInvoices, seedProjects } from "@/lib/seed";
import type { Invoice, Project } from "@/lib/types";
import { deriveProjectStage, dueLine, firstName, invoiceCaption, invoiceHero, methodsForInvoice, milestoneStats, projectCaption, projectInvoices, safeHttpUrl } from "./portal-logic";
import { seedMethods } from "@/lib/seed";

const proj = (id: string) => {
  const p = seedProjects.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return p;
};
const inv = (number: string) => {
  const i = seedInvoices.find((x) => x.number === number);
  if (!i) throw new Error(number);
  return i;
};
const withMs = (p: Project, statuses: Project["milestones"][number]["status"][]): Project => ({ ...p, milestones: p.milestones.map((m, i) => ({ ...m, status: statuses[i] ?? m.status })) });

describe("milestoneStats", () => {
  it("computes the approved share of total value", () => {
    const s = milestoneStats(proj("p-gulberg").milestones);
    expect(s).toMatchObject({ total: 37000000, approvedAmount: 18500000, percent: 50, doneCount: 1, count: 3 });
  });
  it("reaches 73% when the second milestone is approved", () => {
    expect(milestoneStats(withMs(proj("p-gulberg"), ["approved", "approved", "upcoming"]).milestones).percent).toBe(73);
  });
  it("is 0 for no milestones", () => {
    expect(milestoneStats([]).percent).toBe(0);
  });
});

describe("deriveProjectStage", () => {
  const g = proj("p-gulberg");
  const invs = seedInvoices.filter((i) => i.projectId === "p-gulberg");
  it("is approval while a milestone awaits approval", () => {
    expect(deriveProjectStage(g, invs)).toBe("approval");
  });
  it("moves to invoice once nothing awaits approval", () => {
    expect(deriveProjectStage(withMs(g, ["approved", "approved", "upcoming"]), invs)).toBe("invoice");
  });
  it("stays at work while only changes are requested and nothing is approved", () => {
    expect(deriveProjectStage(withMs(g, ["upcoming", "changes_requested", "upcoming"]), [])).toBe("work");
  });
  it("is paid only when every milestone is approved and every invoice is paid", () => {
    const paid: Invoice[] = invs.map((i) => ({ ...i, payments: [{ id: "p", amount: 99999999999, date: "2026-10-01", method: "x", reference: "", recordedAt: "" }] }));
    expect(deriveProjectStage(withMs(g, ["approved", "approved", "approved"]), paid)).toBe("paid");
    expect(deriveProjectStage(withMs(g, ["approved", "approved", "upcoming"]), paid)).toBe("invoice");
  });
  it("handles non-milestone projects", () => {
    expect(deriveProjectStage(proj("p-harbor"), seedInvoices.filter((i) => i.projectId === "p-harbor"))).toBe("invoice");
    expect(deriveProjectStage(proj("p-kareem"), seedInvoices.filter((i) => i.projectId === "p-kareem"))).toBe("paid");
    expect(deriveProjectStage(proj("p-dua"), [])).toBe("work");
  });
  it("captions match the stage", () => {
    expect(projectCaption(g, "approval", "Ayesha")).toBe("One milestone is waiting for your approval");
    expect(projectCaption(withMs(g, ["upcoming", "changes_requested", "upcoming"]), "work", "Ayesha")).toMatch(/Waiting for Ayesha/);
  });
});

describe("projectInvoices", () => {
  it("hides drafts and voids and sorts newest first", () => {
    const list = projectInvoices(proj("p-alnoor"), seedInvoices);
    expect(list.map((i) => i.number)).toEqual(["INV-0043", "INV-0035"]);
    const voided = [{ ...inv("INV-0043"), status: "void" as const }];
    expect(projectInvoices(proj("p-alnoor"), voided)).toEqual([]);
  });
});

describe("invoice presentation", () => {
  const today = "2026-10-05";
  it("describes due state", () => {
    const base = inv("INV-0042");
    expect(dueLine({ ...base, dueDate: "2026-10-20" }, "unpaid", today)).toBe("Due 20 Oct 2026");
    expect(dueLine({ ...base, dueDate: "2026-10-05" }, "unpaid", today)).toBe("Due today");
    expect(dueLine({ ...base, dueDate: "2026-09-20" }, "overdue", today)).toBe("Due 20 Sep 2026 · 15 days overdue");
    expect(dueLine({ ...base, dueDate: "2026-10-04" }, "overdue", today)).toBe("Due 04 Oct 2026 · 1 day overdue");
    expect(dueLine(inv("INV-0041"), "paid", today)).toMatch(/^Paid /);
  });
  it("picks the hero label and estimate", () => {
    expect(invoiceHero(inv("INV-0042"), "unpaid")).toMatchObject({ label: "Amount due", amount: 125000, estimate: true });
    expect(invoiceHero(inv("INV-0044"), "partial")).toMatchObject({ label: "Balance due", amount: 6000000, estimate: true });
    expect(invoiceHero(inv("INV-0041"), "paid")).toMatchObject({ label: "Amount paid", estimate: false });
  });
  it("captions partial payments", () => {
    expect(invoiceCaption(inv("INV-0044"), "partial")).toBe("PKR 30,000 received · PKR 60,000 to go");
  });
});

describe("methodsForInvoice", () => {
  it("keeps the invoice order and drops disabled or missing methods", () => {
    const i = { ...inv("INV-0042"), paymentMethodIds: ["pm-raast", "pm-jazzcash", "pm-gone", "pm-payoneer"] };
    expect(methodsForInvoice(i, seedMethods).map((m) => m.id)).toEqual(["pm-raast", "pm-payoneer"]);
  });
});

describe("helpers", () => {
  it("accepts only http(s) URLs", () => {
    expect(safeHttpUrl("https://payoneer.com/pay/x")).toBe("https://payoneer.com/pay/x");
    expect(safeHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("not a url")).toBeUndefined();
    expect(safeHttpUrl(undefined)).toBeUndefined();
  });
  it("takes the first name", () => {
    expect(firstName("Ayesha Malik")).toBe("Ayesha");
    expect(firstName("  ")).toBe("the freelancer");
  });
});
