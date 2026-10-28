import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { responseToInvoice, toInvoiceCreate } from "@/lib/api/mappers/invoices";
import { previewTotals } from "@/lib/invoice";
import { invoiceResponseFixture } from "@/lib/test/invoices";
import { methodFixtures } from "@/lib/test/payment-methods";
import { milestoneFixture, testProjects } from "@/lib/test/projects";
import { timeEntryFixture } from "@/lib/test/time-entries";
import type { InvoiceDetail, ProjectWithSchedule, RetainerPeriod } from "@/lib/types";
import {
  buildPayload, buildPreview, createFailure, defaultMethodIds, dueDateFor, fixedRemaining, initialSelection, itemsForProject, manualLines, manualRowError,
  parsePercent, readyIds, taxRows, termsOptions, validateStep, type FlowState,
} from "./logic";

const proj = (id: string, schedule: Partial<Pick<ProjectWithSchedule, "milestones" | "retainerPeriods">> = {}): ProjectWithSchedule => {
  const p = testProjects.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return { ...p, milestones: [], retainerPeriods: [], ...schedule };
};
const period = (month: string, over: Partial<RetainerPeriod> = {}): RetainerPeriod => ({ id: `${month}-01`, label: month, start: `${month}-01`, end: `${month}-28`, amount: 130000, ...over });
const baseState = (over: Partial<FlowState> = {}): FlowState => ({
  projectId: "p-harbor", selected: [], manual: [], taxMode: "none", taxName: "", taxRate: "0", discount: "0", termsDays: 14, methodIds: null, notes: "", paymentInstructions: "", ...over,
});
const entry = (id: string, minutes: number, over = {}) => timeEntryFixture({ id, projectId: "p-harbor", minutes, endAt: "2026-10-05T12:00:00Z", description: "Work", ...over });
const inv = (projectId: string, over: Parameters<typeof invoiceResponseFixture>[0] = {}): InvoiceDetail => responseToInvoice(invoiceResponseFixture({ projectId, ...over }));
const TODAY = "2026-10-05";

describe("itemsForProject", () => {
  const time = [entry("t-7", 450, { hourlyRate: 4500 }), entry("t-10", 60, { isInvoiced: true }), entry("t-run", 30, { endAt: undefined }), entry("t-off", 30, { unsynced: true }), entry("t-nb", 30, { billable: false })];
  it("hourly: stopped, synced, uninvoiced billable time at the entry's rate snapshot", () => {
    const items = itemsForProject(proj("p-harbor"), time, [], TODAY);
    expect(items.map((i) => i.id)).toEqual(["t-7"]);
    expect(items[0]).toMatchObject({ kind: "time", amount: 33750 });
    expect(items[0]?.line).toMatchObject({ qty: 7.5, rate: 4500 });
  });
  it("retainer: only unbilled periods; a future period is not selectable", () => {
    const p = proj("p-alnoor", { retainerPeriods: [
      period("2026-08"), // a live invoice bills this start date
      period("2026-09", { invoiceId: "inv-api" }), // invoiced according to the API
      period("2026-10"), period("2026-11"),
    ] });
    const billed = inv("p-alnoor", { retainerPeriodStart: "2026-08-01" });
    const items = itemsForProject(p, [], [billed], TODAY);
    expect(items.map((i) => i.id)).toEqual(["2026-10-01", "2026-11-01"]);
    expect(items.map((i) => !!i.disabled)).toEqual([false, true]);
    expect(itemsForProject(p, [], [inv("p-alnoor", { retainerPeriodStart: "2026-08-01", displayStatus: "CANCELLED", status: "CANCELLED" })], TODAY).map((i) => i.id)).toContain("2026-08-01");
  });
  it("milestone: only approved, un-invoiced milestones with an amount are selectable", () => {
    const ms = [
      milestoneFixture({ id: "m-1", title: "Discovery", status: "approved", amount: 18500000 }), // a live invoice line carries its id
      milestoneFixture({ id: "m-2", title: "Design", status: "submitted", amount: 8500000 }),
      milestoneFixture({ id: "m-3", title: "Build", status: "pending", amount: 10000000 }),
    ];
    const billed = inv("p-gulberg", { items: [{ ...invoiceResponseFixture().items[0]!, timeEntryId: null, milestoneId: "m-1" }] });
    const items = itemsForProject(proj("p-gulberg", { milestones: ms }), [], [billed]);
    expect(items.map((i) => i.id)).toEqual(["m-2", "m-3"]);
    expect(readyIds(items)).toEqual([]);
    const approved = ms.map((m) => (m.id === "m-2" ? { ...m, status: "approved" as const } : m));
    expect(readyIds(itemsForProject(proj("p-gulberg", { milestones: approved }), [], [billed]))).toEqual(["m-2"]);
    expect(itemsForProject(proj("p-gulberg", { milestones: [milestoneFixture({ id: "m-9", status: "approved" })] }), [], [])[0]).toMatchObject({ amount: 0, disabled: true });
  });
  it("fixed: remaining balance = price - already invoiced (after discount, void excluded)", () => {
    const pkr = (over: Parameters<typeof invoiceResponseFixture>[0]) => inv("p-dua", { currency: "PKR", ...over });
    const invoices = [
      pkr({ subtotal: "9000000", discountRate: "0", discountAmount: "0" }),
      pkr({ subtotal: "7000000", discountAmount: "1000000" }),
      pkr({ subtotal: "5000000", status: "CANCELLED", displayStatus: "CANCELLED" }),
    ];
    expect(fixedRemaining(proj("p-dua"), invoices)).toBe(18000000 - 9000000 - 6000000);
    expect(itemsForProject(proj("p-dua"), [], invoices)[0]?.amount).toBe(3000000);
    expect(itemsForProject(proj("p-kareem"), [], [inv("p-kareem", { subtotal: "2400.00" })])).toEqual([]);
  });
});

describe("initialSelection", () => {
  it("selects everything ready, or only the requested period; a retainer preselects one period", () => {
    const p = proj("p-alnoor", { retainerPeriods: [period("2026-09", { label: "Sep 2026" }), period("2026-10", { label: "Oct 2026" })] });
    const items = itemsForProject(p, [], [], TODAY);
    expect(initialSelection(items)).toEqual(["2026-09-01"]);
    expect(initialSelection(items, "2026-10-01", p)).toEqual(["2026-10-01"]);
    expect(initialSelection(items, "oct 2026", p)).toEqual(["2026-10-01"]);
    expect(initialSelection(items, "bogus", p)).toEqual(["2026-09-01"]);
    const hourly = itemsForProject(proj("p-harbor"), [entry("a", 60), entry("b", 60)], [], TODAY);
    expect(initialSelection(hourly)).toEqual(["a", "b"]);
  });
});

describe("manual lines", () => {
  it("skips blank rows, errors on partial rows, parses amounts", () => {
    const ok = { id: "b", description: "Workshop", qty: "2", rate: "125.50" };
    expect(manualRowError({ id: "a", description: "", qty: "1", rate: "" })).toBeNull();
    expect(manualRowError({ id: "c", description: "Oops", qty: "0", rate: "10" })).toMatch(/Quantity/);
    expect(manualRowError({ ...ok, description: " " })).toMatch(/description/);
    expect(manualRowError({ ...ok, rate: "" })).toMatch(/Rate/);
    expect(manualRowError(ok)).toBeNull();
    expect(manualLines([ok, { id: "a", description: "", qty: "1", rate: "" }])).toEqual([{ id: "b", description: "Workshop", qty: 2, rate: 12550, source: { type: "manual" } }]);
  });
});

describe("parsers and helpers", () => {
  it("parsePercent", () => {
    expect(parsePercent("")).toBe(0);
    expect(parsePercent("17.5")).toBe(17.5);
    expect(parsePercent("101")).toBeNull();
    expect(parsePercent("abc")).toBeNull();
  });
  it("terms and due date", () => {
    expect(termsOptions(21)).toEqual([0, 7, 14, 21, 30, 45, 60]);
    expect(dueDateFor("2026-10-05", 14)).toBe("2026-10-19");
    expect(dueDateFor("2026-10-05", 0)).toBe("2026-10-05");
  });
  it("defaultMethodIds is the enabled defaults only (what the server would snapshot)", () => {
    const methods = methodFixtures();
    expect(defaultMethodIds(methods)).toEqual(methods.filter((m) => m.enabled && m.isDefault).map((m) => m.id));
    expect(defaultMethodIds(methods.map((m) => ({ ...m, isDefault: false })))).toEqual([]);
    expect(defaultMethodIds([])).toEqual([]);
  });
  it("taxRows: defaults omitted, none is [], custom is one row", () => {
    expect(taxRows(baseState({ taxMode: "default" }))).toBeNull();
    expect(taxRows(baseState({ taxMode: "none" }))).toEqual([]);
    expect(taxRows(baseState({ taxMode: "custom", taxName: "VAT", taxRate: "15" }))).toEqual([{ name: "VAT", rate: "15" }]);
  });
});

describe("validateStep", () => {
  const items = itemsForProject(proj("p-harbor"), [entry("t-7", 450)], [], TODAY);
  const ctx = (s: FlowState) => ({ state: s, project: proj("p-harbor"), items });
  it("requires a line on step 2", () => {
    expect(validateStep(2, ctx(baseState()))).toMatch(/at least one/);
    expect(validateStep(2, ctx(baseState({ selected: ["t-7"] })))).toBeNull();
    expect(validateStep(2, ctx(baseState({ manual: [{ id: "m", description: "Workshop", qty: "1", rate: "50" }] })))).toBeNull();
    expect(validateStep(2, ctx(baseState({ selected: ["t-7"], manual: [{ id: "m", description: "Half", qty: "-1", rate: "5" }] })))).toMatch(/incomplete/);
  });
  it("allows one retainer period only", () => {
    const p = proj("p-alnoor", { retainerPeriods: [period("2026-09"), period("2026-10")] });
    const r = itemsForProject(p, [], [], TODAY);
    expect(validateStep(2, { state: baseState({ selected: ["2026-09-01", "2026-10-01"] }), project: p, items: r })).toMatch(/one retainer/);
    expect(validateStep(2, { state: baseState({ selected: ["2026-09-01"] }), project: p, items: r })).toBeNull();
  });
  it("validates tax, a percent discount and text limits on step 3", () => {
    const s = baseState({ selected: ["t-7"] });
    expect(validateStep(3, ctx({ ...s, taxMode: "custom", taxName: "", taxRate: "10" }))).toMatch(/Tax needs a name/);
    expect(validateStep(3, ctx({ ...s, taxMode: "custom", taxName: "VAT", taxRate: "200" }))).toMatch(/Tax must/);
    expect(validateStep(3, ctx({ ...s, discount: "x" }))).toMatch(/Discount/);
    expect(validateStep(3, ctx({ ...s, discount: "101" }))).toMatch(/Discount/);
    expect(validateStep(3, ctx({ ...s, paymentInstructions: "x".repeat(2001) }))).toMatch(/Payment note/);
    expect(validateStep(3, ctx(s))).toBeNull();
  });
  it("never blocks on payment methods (none is a valid choice)", () => {
    expect(validateStep(4, ctx(baseState({ methodIds: [] })))).toBeNull();
  });
});

describe("buildPayload", () => {
  const build = (state: FlowState, projectId: string, items: ReturnType<typeof itemsForProject>) =>
    buildPayload(state, testProjects.find((p) => p.id === projectId)!, items, TODAY);

  it("manual lines go to items as minor units; the API body carries decimal strings", () => {
    const state = baseState({ manual: [{ id: "m", description: "Workshop", qty: "1.5", rate: "125.50" }] });
    const input = build(state, "p-harbor", []);
    expect(input.items).toEqual([{ description: "Workshop", quantity: 1.5, unitPrice: 12550 }]);
    expect(toInvoiceCreate(input).items).toEqual([{ description: "Workshop", quantity: "1.50", unitPrice: "125.50" }]);
    expect(input.dueDate).toBe("2026-10-19");
  });
  it("time entries go to timeEntryIds (no lines sent for them)", () => {
    const items = itemsForProject(proj("p-harbor"), [entry("t-7", 450), entry("t-8", 360)], [], TODAY);
    const input = build(baseState({ selected: ["t-7", "t-8"] }), "p-harbor", items);
    expect(input.timeEntryIds).toEqual(["t-7", "t-8"]);
    expect(input.items).toEqual([]);
  });
  it("approved milestones go to milestoneIds", () => {
    const ms = [milestoneFixture({ id: "m-1", status: "approved", amount: 100 }), milestoneFixture({ id: "m-2", status: "pending", amount: 100 })];
    const items = itemsForProject(proj("p-gulberg", { milestones: ms }), [], []);
    const input = build(baseState({ projectId: "p-gulberg", selected: ["m-1", "m-2"] }), "p-gulberg", items);
    expect(input.milestoneIds).toEqual(["m-1"]); // the pending one is not selectable
  });
  it("a retainer period goes to retainerPeriodStart and sends no line of its own", () => {
    const items = itemsForProject(proj("p-alnoor", { retainerPeriods: [period("2026-10")] }), [], [], TODAY);
    const input = build(baseState({ projectId: "p-alnoor", selected: ["2026-10-01"] }), "p-alnoor", items);
    expect(input.retainerPeriodStart).toBe("2026-10-01");
    expect(input.items).toEqual([]);
    expect(toInvoiceCreate(input).retainerPeriodStart).toBe("2026-10-01");
  });
  it("the fixed balance is sent as a manual item", () => {
    const items = itemsForProject(proj("p-dua"), [], []);
    const input = build(baseState({ projectId: "p-dua", selected: ["fixed-balance"] }), "p-dua", items);
    expect(input.items).toEqual([{ description: "Logo refresh · fixed price", quantity: 1, unitPrice: 18000000 }]);
  });
  it("paymentMethodIds: omitted vs [] vs a list; taxes: omitted vs [] vs custom; percent discount", () => {
    const items = itemsForProject(proj("p-harbor"), [entry("t-7", 60)], [], TODAY);
    const body = (over: Partial<FlowState>) => toInvoiceCreate(build(baseState({ selected: ["t-7"], ...over }), "p-harbor", items));
    expect("paymentMethodIds" in body({ methodIds: null })).toBe(false);
    expect(body({ methodIds: [] }).paymentMethodIds).toEqual([]);
    expect(body({ methodIds: ["a"] }).paymentMethodIds).toEqual(["a"]);
    expect("taxes" in body({ taxMode: "default" })).toBe(false);
    expect(body({ taxMode: "none" }).taxes).toEqual([]);
    expect(body({ taxMode: "custom", taxName: "VAT", taxRate: "15", discount: "10" })).toMatchObject({ taxes: [{ name: "VAT", rate: "15" }], discountRate: "10" });
  });
});

describe("createFailure", () => {
  const http = (status: number, data: unknown) => new AxiosError("x", "ERR", undefined, undefined, { status, data } as never);
  it("sends a 422 to the step of its field, a 409 to Items, a 429 to a try-later message", () => {
    expect(createFailure(http(422, { detail: [{ loc: ["body", "payment_method_ids", 0], msg: "bad id" }] }))).toMatchObject({ step: 4, message: "bad id" });
    expect(createFailure(http(422, { detail: [{ loc: ["body", "taxes", 0, "rate"], msg: "too high" }] })).step).toBe(3);
    expect(createFailure(http(422, { detail: [{ loc: ["body"], msg: "needs a line" }] })).step).toBe(2);
    expect(createFailure(http(409, { detail: "Already invoiced" }))).toMatchObject({ step: 2, conflict: true, message: "Already invoiced" });
    expect(createFailure(http(429, { detail: "slow" }))).toMatchObject({ rateLimited: true });
    expect(createFailure(new AxiosError("Network Error"))).toMatchObject({ step: 5, conflict: false });
  });
});

describe("preview", () => {
  it("applies a percent discount and one custom tax in integer minor units", () => {
    const items = itemsForProject(proj("p-harbor"), [entry("t-7", 450, { hourlyRate: 4500 })], [], TODAY);
    const state = baseState({ selected: ["t-7"], taxMode: "custom", taxName: "VAT", taxRate: "10", discount: "10", manual: [{ id: "m", description: "Workshop", qty: "1", rate: "125" }] });
    const doc = buildPreview(state, testProjects[0], items, TODAY, "USD");
    // 7.5h x 45 = 337.50 + 125 = 462.50; 10% off = 46.25 -> 416.25; +10% = 41.63 (half up) -> 457.88
    expect(doc).toMatchObject({ subtotal: 46250, discount: 4625, total: 45788, balance: 45788 });
    expect(doc.taxes).toEqual([{ label: "VAT (10%)", amount: 4163 }]);
  });
});

describe("previewTotals vs the server (parity fixtures)", () => {
  // Server-shaped InvoiceResponse numbers (compute_totals): the preview must reproduce subtotal, tax and total.
  const cases = [
    { name: "exclusive 15% VAT, 10% discount", subtotal: "1000.00", discountRate: "10", taxes: [{ rate: "15" }], server: { discountAmount: "100.00", taxAmount: "135.00", withholdingAmount: "0.00", total: "1035.00" } },
    { name: "withholding 10% on top of 15% VAT", subtotal: "2000.00", discountRate: "0", taxes: [{ rate: "15" }, { rate: "10", isWithholding: true }], server: { discountAmount: "0.00", taxAmount: "300.00", withholdingAmount: "200.00", total: "2100.00" } },
    { name: "inclusive 18% (extracted, not added)", subtotal: "1180.00", discountRate: "0", taxes: [{ rate: "18", isInclusive: true }], server: { discountAmount: "0.00", taxAmount: "180.00", withholdingAmount: "0.00", total: "1180.00" } },
    { name: "compound 5% on net + 10%", subtotal: "100.00", discountRate: "0", taxes: [{ rate: "10" }, { rate: "5", isCompound: true }], server: { discountAmount: "0.00", taxAmount: "15.50", withholdingAmount: "0.00", total: "115.50" } },
    { name: "rounds half up", subtotal: "10.05", discountRate: "0", taxes: [{ rate: "10" }], server: { discountAmount: "0.00", taxAmount: "1.01", withholdingAmount: "0.00", total: "11.06" } },
  ];
  it.each(cases)("$name", ({ subtotal, discountRate, taxes, server }) => {
    const response = invoiceResponseFixture({ subtotal, discountRate, ...server });
    const expected = responseToInvoice(response);
    const t = previewTotals(expected.subtotal, discountRate, taxes);
    expect(t.discountAmount).toBe(expected.discountAmount);
    expect(t.taxAmount).toBe(expected.taxAmount);
    expect(t.withholdingAmount).toBe(expected.withholdingAmount);
    expect(t.total).toBe(expected.total);
  });
});
