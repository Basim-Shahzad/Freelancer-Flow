import { describe, expect, it } from "vitest";
import { calcTotals } from "@/lib/invoice";
import { seedClients, seedInvoices, seedMethods, seedProjects, seedTime } from "@/lib/seed";
import type { Project } from "@/lib/types";
import {
  buildInput, buildTransientInvoice, defaultMethodIds, dueDateFor, fixedRemaining, initialSelection, itemsForProject, manualLines, manualRowError,
  parseDiscount, parsePercent, readyIds, termsOptions, validateStep, type FlowState,
} from "./logic";

const proj = (id: string): Project => {
  const p = seedProjects.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return p;
};
const baseState = (over: Partial<FlowState> = {}): FlowState => ({ projectId: "p-harbor", selected: [], manual: [], tax: "0", discount: "0", termsDays: 14, methodIds: ["pm-payoneer"], ...over });

describe("itemsForProject", () => {
  it("hourly: uninvoiced billable time with hours x rate", () => {
    const items = itemsForProject(proj("p-harbor"), seedTime, seedInvoices);
    expect(items.map((i) => i.id)).not.toContain("t-10"); // already invoiced
    expect(items).toHaveLength(6);
    const t7 = items.find((i) => i.id === "t-7");
    expect(t7?.line.qty).toBe(7.5);
    expect(t7?.line.rate).toBe(4500);
    expect(t7?.amount).toBe(33750);
  });
  it("retainer: only unbilled periods", () => {
    const p: Project = { ...proj("p-alnoor"), retainerPeriods: [...proj("p-alnoor").retainerPeriods, { id: "rp-nov", label: "Nov 2026", start: "2026-11-01", end: "2026-11-30", amount: 130000 }] };
    expect(itemsForProject(p, [], seedInvoices).map((i) => i.id)).toEqual(["rp-nov"]);
    expect(itemsForProject(proj("p-alnoor"), [], seedInvoices)).toEqual([]);
  });
  it("milestone: only approved and un-invoiced are selectable", () => {
    const items = itemsForProject(proj("p-gulberg"), [], seedInvoices);
    expect(items.map((i) => i.id)).toEqual(["m-2", "m-3"]); // m-1 already invoiced
    expect(items.every((i) => i.disabled)).toBe(true);
    expect(readyIds(items)).toEqual([]);
    const approved: Project = { ...proj("p-gulberg"), milestones: proj("p-gulberg").milestones.map((m) => (m.id === "m-2" ? { ...m, status: "approved" as const } : m)) };
    expect(readyIds(itemsForProject(approved, [], seedInvoices))).toEqual(["m-2"]);
  });
  it("fixed: remaining balance = fixed amount - already invoiced", () => {
    expect(fixedRemaining(proj("p-dua"), seedInvoices)).toBe(18000000 - 9000000 - 6000000);
    const [item] = itemsForProject(proj("p-dua"), [], seedInvoices);
    expect(item?.amount).toBe(3000000);
    expect(itemsForProject(proj("p-kareem"), [], seedInvoices)).toEqual([]); // fully invoiced (2,400 of 2,400)
  });
});

describe("initialSelection", () => {
  it("selects everything ready, or only the requested period", () => {
    const p: Project = { ...proj("p-alnoor"), retainerPeriods: [{ id: "rp-nov", label: "Nov 2026", start: "2026-11-01", end: "2026-11-30", amount: 1 }, { id: "rp-dec", label: "Dec 2026", start: "2026-12-01", end: "2026-12-31", amount: 1 }] };
    const items = itemsForProject(p, [], []);
    expect(initialSelection(items)).toEqual(["rp-nov", "rp-dec"]);
    expect(initialSelection(items, "rp-dec", p)).toEqual(["rp-dec"]);
    expect(initialSelection(items, "nov 2026", p)).toEqual(["rp-nov"]);
    expect(initialSelection(items, "bogus", p)).toEqual(["rp-nov", "rp-dec"]);
  });
});

describe("manual lines", () => {
  it("skips blank rows, errors on partial rows, parses amounts", () => {
    const blank = { id: "a", description: "", qty: "1", rate: "" };
    const ok = { id: "b", description: "Workshop", qty: "2", rate: "125.50" };
    const bad = { id: "c", description: "Oops", qty: "0", rate: "10" };
    expect(manualRowError(blank)).toBeNull();
    expect(manualRowError(bad)).toMatch(/Quantity/);
    expect(manualRowError({ ...ok, description: " " })).toMatch(/description/);
    expect(manualRowError({ ...ok, rate: "" })).toMatch(/Rate/);
    expect(manualRowError(ok)).toBeNull();
  });
  it("converts valid rows to lines", () => {
    const lines = manualLines([{ id: "b", description: "Workshop", qty: "2", rate: "125.50" }, { id: "a", description: "", qty: "1", rate: "" }]);
    expect(lines).toEqual([{ id: "b", description: "Workshop", qty: 2, rate: 12550, source: { type: "manual" } }]);
  });
});

describe("parsers and helpers", () => {
  it("parsePercent / parseDiscount", () => {
    expect(parsePercent("")).toBe(0);
    expect(parsePercent("17.5")).toBe(17.5);
    expect(parsePercent("101")).toBeNull();
    expect(parsePercent("abc")).toBeNull();
    expect(parseDiscount("12.5")).toBe(1250);
    expect(parseDiscount("-3")).toBeNull();
  });
  it("terms and due date", () => {
    expect(termsOptions(21)).toEqual([0, 7, 14, 21, 30, 45, 60]);
    expect(dueDateFor("2026-10-05", 14)).toBe("2026-10-19");
    expect(dueDateFor("2026-10-05", 0)).toBe("2026-10-05");
  });
  it("defaultMethodIds prefers the client's methods, else the default", () => {
    expect(defaultMethodIds(seedMethods, seedClients.find((c) => c.id === "c-harbor"))).toEqual(["pm-payoneer", "pm-esfca"]);
    expect(defaultMethodIds(seedMethods, seedClients.find((c) => c.id === "c-dua"))).toEqual(["pm-raast"]); // jazzcash disabled
    expect(defaultMethodIds(seedMethods, undefined)).toEqual(["pm-payoneer"]);
    expect(defaultMethodIds([], undefined)).toEqual([]);
  });
});

describe("validateStep", () => {
  const items = itemsForProject(proj("p-harbor"), seedTime, seedInvoices);
  const ctx = (s: FlowState) => ({ state: s, project: proj("p-harbor"), items, enabledMethodCount: 4 });
  it("requires a line on step 2", () => {
    expect(validateStep(2, ctx(baseState()))).toMatch(/at least one/);
    expect(validateStep(2, ctx(baseState({ selected: ["t-7"] })))).toBeNull();
    expect(validateStep(2, ctx(baseState({ manual: [{ id: "m", description: "Workshop", qty: "1", rate: "50" }] })))).toBeNull();
    expect(validateStep(2, ctx(baseState({ selected: ["t-7"], manual: [{ id: "m", description: "Half", qty: "-1", rate: "5" }] })))).toMatch(/incomplete/);
  });
  it("validates tax and discount on step 3", () => {
    const s = baseState({ selected: ["t-7"] });
    expect(validateStep(3, ctx({ ...s, tax: "200" }))).toMatch(/Tax/);
    expect(validateStep(3, ctx({ ...s, discount: "x" }))).toMatch(/Discount/);
    expect(validateStep(3, ctx({ ...s, discount: "99999" }))).toMatch(/more than the subtotal/);
    expect(validateStep(3, ctx(s))).toBeNull();
  });
  it("requires a method only when some are enabled", () => {
    expect(validateStep(4, ctx(baseState({ methodIds: [] })))).toMatch(/at least one/);
    expect(validateStep(4, { ...ctx(baseState({ methodIds: [] })), enabledMethodCount: 0 })).toBeNull();
  });
});

describe("buildInput / transient invoice", () => {
  it("collects refs and totals", () => {
    const project = proj("p-harbor");
    const client = seedClients[0]!;
    const items = itemsForProject(project, seedTime, seedInvoices);
    const state = baseState({ selected: ["t-7", "t-8"], tax: "10", discount: "50", manual: [{ id: "m", description: "Workshop", qty: "1", rate: "125" }] });
    const input = buildInput(state, project, client, items, true);
    expect(input.timeEntryIds).toEqual(["t-7", "t-8"]);
    expect(input.asDraft).toBe(true);
    expect(input.lines).toHaveLength(3);
    const inv = buildTransientInvoice(input, "INV-0046", "2026-10-05");
    // 7.5h*45 + 6h*45 + 125 = 337.5 + 270 + 125 = 732.50 ; minus 50 = 682.50 ; +10% = 750.75
    expect(calcTotals(inv).total).toBe(75075);
    expect(inv.status).toBe("draft");
  });
});
