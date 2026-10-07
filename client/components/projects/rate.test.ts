import { describe, expect, it } from "vitest";
import type { InvoiceView } from "@/lib/selectors";
import type { Project, TimeEntry } from "@/lib/types";
import {
  billedOf, billingSummary, blendedByCurrency, billedByCurrency, effectiveRate, floorFor, hoursText, matchesRateFilter, MIN_RATE_MINUTES,
  minutesFeeBuys, nextDue, rateRow, rateSentence, relativeDays, sortRateRows, splitByCurrency, verdictOf, type OwnRate, type RateRow,
} from "./rate";

const TODAY = "2026-10-05";
const own: OwnRate = { hourlyRate: 4000, defaultCurrency: "USD" };
const project = (over: Partial<Project>): Project => ({
  id: "p", clientId: "c", name: "P", billingType: "fixed", currency: "USD", status: "active", startDate: "2026-08-01",
  milestones: [], retainerPeriods: [], shareToken: "t", notes: "", fixedAmount: 360000, ...over,
});
const entry = (minutes: number, over: Partial<TimeEntry> = {}): TimeEntry => ({ id: `t${minutes}`, projectId: "p", description: "x", date: "2026-10-01", minutes, billable: true, updatedAt: "", ...over });
const view = (display: InvoiceView["display"], total: number, balance = total, over: Partial<InvoiceView> = {}): InvoiceView =>
  ({ projectId: "p", number: "INV-1", currency: "USD", dueDate: "2026-10-20", display, totals: { total, balance, paid: total - balance }, ...over } as unknown as InvoiceView);
const row = (p: Project, time: TimeEntry[] = [], views: InvoiceView[] = [], o: OwnRate = own, unbilledHourly = 0) => rateRow(p, { time, views, today: TODAY, own: o, unbilledHourly });

describe("effectiveRate", () => {
  it("is fee divided by hours", () => {
    expect(effectiveRate(360000, 118 * 60)).toBe(3051);
    expect(effectiveRate(360000, 60)).toBe(360000);
  });
  it("is null with too little time or no fee", () => {
    expect(effectiveRate(360000, MIN_RATE_MINUTES - 1)).toBeNull();
    expect(effectiveRate(0, 600)).toBeNull();
  });
});

describe("floor and verdict", () => {
  it("uses the own rate in the default currency and converts (estimated) for others", () => {
    expect(floorFor("USD", own)).toEqual({ amount: 4000, estimated: false });
    const pkr = floorFor("PKR", own);
    expect(pkr?.estimated).toBe(true);
    expect(pkr?.amount).toBe(1114400);
  });
  it("has no floor when no rate is set", () => {
    expect(floorFor("USD", { defaultCurrency: "USD" })).toBeNull();
    expect(floorFor("USD", { defaultCurrency: "USD", hourlyRate: 0 })).toBeNull();
  });
  it("compares and computes what the fee buys", () => {
    expect(verdictOf(3051, 4000)).toBe("below");
    expect(verdictOf(5300, 4000)).toBe("above");
    expect(verdictOf(4000, 4000)).toBe("at");
    expect(minutesFeeBuys(360000, 4000)).toBe(5400);
  });
});

describe("rateRow", () => {
  it("computes a fixed-fee row below the floor", () => {
    const r = row(project({}), [entry(118 * 60)], [view("unpaid", 100000)]);
    expect(r.kind).toBe("fee");
    expect(r.rate).toBe(3051);
    expect(r.verdict).toBe("below");
    expect(r.buysMinutes).toBe(5400);
    expect(r.overMinutes).toBe(118 * 60 - 5400);
    expect(r.notInvoiced).toBe(260000);
    expect(r.sortRate).toBe(3051);
  });
  it("ignores non-billable time and other projects", () => {
    const r = row(project({}), [entry(120, { billable: false }), entry(120, { projectId: "other" }), entry(60)]);
    expect(r.minutes).toBe(60);
  });
  it("omits verdicts gracefully with no hourly rate", () => {
    const r = row(project({}), [entry(600)], [], { defaultCurrency: "USD" });
    expect(r.rate).toBe(36000);
    expect(r.floor).toBeNull();
    expect(r.verdict).toBeNull();
    expect(r.buysMinutes).toBeNull();
    expect(r.overMinutes).toBeNull();
  });
  it("uses the contract rate for hourly work and the supplied unbilled amount", () => {
    const r = row(project({ billingType: "hourly", hourlyRate: 4500, fixedAmount: undefined }), [entry(600)], [], own, 12345);
    expect(r.kind).toBe("hourly");
    expect(r.rate).toBe(4500);
    expect(r.verdict).toBe("above");
    expect(r.notInvoiced).toBe(12345);
  });
  it("sums retainer periods that have started", () => {
    const p = project({ billingType: "retainer", fixedAmount: undefined, retainerPeriods: [
      { id: "a", label: "Sep", start: "2026-09-01", end: "2026-09-30", amount: 100000 },
      { id: "b", label: "Oct", start: "2026-10-01", end: "2026-10-31", amount: 100000 },
      { id: "c", label: "Nov", start: "2026-11-01", end: "2026-11-30", amount: 100000 },
    ] });
    const r = row(p, [entry(20 * 60)]);
    expect(r.fee).toBe(200000);
    expect(r.rate).toBe(10000);
  });
  it("has no rate before enough time is logged", () => {
    const r = row(project({}), [entry(30)]);
    expect(r.rate).toBeNull();
    expect(r.verdict).toBeNull();
    expect(r.sortRate).toBeNull();
  });
  it("orders by a converted rate for foreign-currency projects", () => {
    const r = row(project({ currency: "PKR", fixedAmount: 18000000 }), [entry(10 * 60)]);
    expect(r.rate).toBe(1800000);
    expect(r.floor?.estimated).toBe(true);
    expect(r.sortRate).toBe(6461);
  });
});

describe("billedOf and nextDue", () => {
  it("excludes drafts, voids and write-offs", () => {
    expect(billedOf([view("unpaid", 100), view("draft", 50), view("void", 40), view("written_off", 30), view("paid", 10, 0)])).toBe(110);
  });
  it("picks the earliest dated item and skips completed projects", () => {
    const p = project({ billingType: "milestone", milestones: [
      { id: "1", title: "A", description: "", amount: 1, dueDate: "2026-09-01", status: "approved" },
      { id: "2", title: "B", description: "", amount: 1, dueDate: "2026-10-30", status: "upcoming" },
    ] });
    expect(nextDue(p, [view("unpaid", 1)], TODAY)).toEqual({ date: "2026-10-20", label: "INV-1" });
    expect(nextDue(p, [], TODAY)?.label).toBe("“B”");
    expect(nextDue({ ...p, status: "completed" }, [], TODAY)).toBeNull();
    expect(nextDue(project({}), [], TODAY)).toBeNull();
  });
});

describe("sorting and filtering", () => {
  const a = row(project({ id: "a", name: "A", startDate: "2026-01-01" }), [entry(60, { projectId: "a" })], [view("unpaid", 1, 1, { projectId: "a", dueDate: "2026-10-30" })]);
  const b = row(project({ id: "b", name: "B", startDate: "2026-03-01", fixedAmount: 100000 }), [entry(600, { projectId: "b" })], [view("unpaid", 1, 1, { projectId: "b", dueDate: "2026-10-10" })]);
  const c = row(project({ id: "c", name: "C", startDate: "2026-02-01", status: "completed" }), []);
  it("worst rate first puts rows without a rate last", () => {
    expect(sortRateRows([a, b, c], "worst").map((r) => r.project.id)).toEqual(["b", "a", "c"]);
  });
  it("due soonest puts undated rows last", () => {
    expect(sortRateRows([a, b, c], "due").map((r) => r.project.id)).toEqual(["b", "a", "c"]);
  });
  it("newest first by start date", () => {
    expect(sortRateRows([a, b, c], "newest").map((r) => r.project.id)).toEqual(["b", "c", "a"]);
  });
  it("filters open and finished", () => {
    expect([a, b, c].filter((r) => matchesRateFilter(r, "open")).length).toBe(2);
    expect([a, b, c].filter((r) => matchesRateFilter(r, "finished")).map((r) => r.project.id)).toEqual(["c"]);
    expect([a, b, c].filter((r) => matchesRateFilter(r, "all")).length).toBe(3);
  });
});

describe("aggregation per currency", () => {
  const usd = row(project({ id: "u", fixedAmount: 360000 }), [entry(120 * 60, { projectId: "u" })], [view("unpaid", 100000, 100000, { projectId: "u" })]);
  const usd2 = row(project({ id: "u2", fixedAmount: 120000 }), [entry(20 * 60, { projectId: "u2" })], [view("paid", 50000, 0, { projectId: "u2" })]);
  const pkr = row(project({ id: "k", currency: "PKR", fixedAmount: 1000000 }), [entry(10 * 60, { projectId: "k" })], [view("unpaid", 700000, 700000, { projectId: "k", currency: "PKR" })]);
  const done = row(project({ id: "d", status: "completed", fixedAmount: 999999 }), [entry(60, { projectId: "d" })], [view("paid", 999999, 0, { projectId: "d" })]);
  const rows: RateRow[] = [usd, usd2, pkr, done];
  it("blends fee over hours per currency, open work only", () => {
    expect(blendedByCurrency(rows)).toEqual({ USD: Math.round((480000 * 60) / (140 * 60)), PKR: 100000 });
  });
  it("sums billed so far per currency without mixing them", () => {
    expect(billedByCurrency(rows)).toEqual({ USD: 150000, PKR: 700000 });
  });
  it("splits a headline currency from the others", () => {
    expect(splitByCurrency({ PKR: 5, USD: 7 }, "USD")).toEqual({ primary: ["USD", 7], others: [["PKR", 5]] });
    expect(splitByCurrency({ PKR: 5 }, "USD")).toEqual({ primary: ["PKR", 5], others: [] });
    expect(splitByCurrency({}, "USD")).toEqual({ primary: null, others: [] });
  });
});

describe("text helpers", () => {
  it("formats hours and relative days", () => {
    expect(hoursText(118 * 60)).toBe("118 h");
    expect(hoursText(90)).toBe("1.5 h");
    expect(relativeDays("2026-11-02", TODAY)).toBe("in 28 days");
    expect(relativeDays("2026-10-04", TODAY)).toBe("1 day ago");
    expect(relativeDays(TODAY, TODAY)).toBe("today");
  });
  it("summarises billing with the next due date", () => {
    const r = row(project({}), [], [view("unpaid", 1)]);
    expect(billingSummary(r)).toBe("Fixed fee USD 3,600.00 · INV-1 due 20 Oct 2026");
    expect(billingSummary(row(project({ billingType: "hourly", hourlyRate: 4500 })))).toBe("Hourly, USD 45.00 / h");
  });
  it("writes the header sentence, and drops the floor part with no rate set", () => {
    const below = row(project({}), [entry(118 * 60)], [view("unpaid", 100000)]);
    expect(rateSentence(below)).toBe("Paying USD 30.51 an hour at 118 h — USD 9.49 below your USD 40.00 rate. USD 2,600.00 of the USD 3,600.00 fee isn’t invoiced yet.");
    const none = row(project({}), [entry(118 * 60)], [], { defaultCurrency: "USD" });
    expect(rateSentence(none)).toBe("Paying USD 30.51 an hour at 118 h. USD 3,600.00 of the USD 3,600.00 fee isn’t invoiced yet.");
    expect(rateSentence(row(project({}), [entry(10)]))).toMatch(/^Log at least 1 h/);
  });
});
