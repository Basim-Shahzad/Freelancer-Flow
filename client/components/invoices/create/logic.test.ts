import { describe, expect, it } from "vitest";
import { calcTotals } from "@/lib/invoice";
import { seedInvoices, seedTime } from "@/lib/seed";
import { methodFixtures } from "@/lib/test/payment-methods";
import { testClients } from "@/lib/test/clients";
import { milestoneFixture, testProjects } from "@/lib/test/projects";
import type { ProjectWithSchedule, RetainerPeriod } from "@/lib/types";
import {
  buildInput, buildTransientInvoice, defaultMethodIds, dueDateFor, fixedRemaining, initialSelection, itemsForProject, manualLines, manualRowError,
  parseDiscount, parsePercent, readyIds, termsOptions, validateStep, type FlowState,
} from "./logic";

const proj = (id: string, schedule: Partial<Pick<ProjectWithSchedule, "milestones" | "retainerPeriods">> = {}): ProjectWithSchedule => {
  const p = testProjects.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return { ...p, milestones: [], retainerPeriods: [], ...schedule };
};
const period = (month: string, over: Partial<RetainerPeriod> = {}): RetainerPeriod => ({ id: `${month}-01`, label: month, start: `${month}-01`, end: `${month}-28`, amount: 130000, ...over });
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
  it("retainer: only unbilled periods (by the API's invoiceId or a live invoice line)", () => {
    const p = proj("p-alnoor", { retainerPeriods: [
      period("2026-08", { id: "rp-aug" }), period("2026-09", { id: "rp-sep" }), // referenced by invoice lines
      period("2026-10", { invoiceId: "inv-api" }), // invoiced according to the API
      period("2026-11"),
    ] });
    expect(itemsForProject(p, [], seedInvoices).map((i) => i.id)).toEqual(["2026-11-01"]);
    expect(itemsForProject(proj("p-alnoor"), [], seedInvoices)).toEqual([]);
  });
  it("milestone: only approved, un-invoiced milestones with an amount are selectable", () => {
    const ms = [
      milestoneFixture({ id: "m-1", title: "Discovery", status: "approved", amount: 18500000 }), // referenced by an invoice line
      milestoneFixture({ id: "m-2", title: "Design", status: "submitted", amount: 8500000 }),
      milestoneFixture({ id: "m-3", title: "Build", status: "pending", amount: 10000000 }),
    ];
    const items = itemsForProject(proj("p-gulberg", { milestones: ms }), [], seedInvoices);
    expect(items.map((i) => i.id)).toEqual(["m-2", "m-3"]); // m-1 already invoiced
    expect(items.every((i) => i.disabled)).toBe(true);
    expect(readyIds(items)).toEqual([]);
    const approved = ms.map((m) => (m.id === "m-2" ? { ...m, status: "approved" as const } : m));
    expect(readyIds(itemsForProject(proj("p-gulberg", { milestones: approved }), [], seedInvoices))).toEqual(["m-2"]);
  });
  it("milestone: an approved milestone without an amount is not selectable", () => {
    const [item] = itemsForProject(proj("p-gulberg", { milestones: [milestoneFixture({ id: "m-9", status: "approved" })] }), [], []);
    expect(item).toMatchObject({ id: "m-9", amount: 0, disabled: true });
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
    const p = proj("p-alnoor", { retainerPeriods: [period("2026-11", { label: "Nov 2026" }), period("2026-12", { label: "Dec 2026" })] });
    const items = itemsForProject(p, [], []);
    expect(initialSelection(items)).toEqual(["2026-11-01", "2026-12-01"]);
    expect(initialSelection(items, "2026-12-01", p)).toEqual(["2026-12-01"]);
    expect(initialSelection(items, "nov 2026", p)).toEqual(["2026-11-01"]);
    expect(initialSelection(items, "bogus", p)).toEqual(["2026-11-01", "2026-12-01"]);
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
  it("defaultMethodIds picks the default enabled method", () => {
    const seedMethods = methodFixtures();
    expect(defaultMethodIds(seedMethods)).toEqual(["pm-payoneer"]);
    expect(defaultMethodIds(seedMethods.map((m) => ({ ...m, isDefault: false })))).toEqual(["pm-payoneer"]); // first enabled
    expect(defaultMethodIds([])).toEqual([]);
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
    const client = testClients[0]!;
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
