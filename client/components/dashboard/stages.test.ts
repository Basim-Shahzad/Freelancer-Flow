import { describe, expect, it } from "vitest";
import type { InvoiceView } from "@/lib/selectors";
import type { Payment, Project, TimeEntry } from "@/lib/types";
import { activeCurrencies, sentToPaidDays, stagesByCurrency } from "./stages";
import { bucketDayStrip, entrySegments, liveSegment, SLOT_COUNT } from "./day-strip";

const TODAY = "2026-10-05";
const pay = (date: string, amount: number): Payment => ({ id: date + amount, amount, date, method: "Raast", reference: "", recordedAt: `${date}T10:00:00Z` });
const bal = (n: number) => ({ balance: n, total: n, paid: 0, subtotal: n, discount: 0, taxable: n, tax: 0 });
const inv = (over: Partial<InvoiceView> & { display: InvoiceView["display"] }, n = 100): InvoiceView =>
  ({ id: "i", number: "INV-1", currency: "USD", issueDate: "2026-09-01", dueDate: "2026-10-20", payments: [], totals: bal(n), ...over } as unknown as InvoiceView);
const hourly = (id: string, currency: "USD" | "PKR", rate: number): Project =>
  ({ id, clientId: "c", name: id, billingType: "hourly", currency, status: "active", hourlyRate: rate, milestones: [], retainerPeriods: [] } as unknown as Project);
const te = (projectId: string, minutes: number, extra: Partial<TimeEntry> = {}): TimeEntry =>
  ({ id: projectId + minutes, projectId, description: "", date: TODAY, minutes, billable: true, updatedAt: "", ...extra });

describe("stagesByCurrency", () => {
  const views = [
    inv({ display: "draft", currency: "USD" }, 800),
    inv({ display: "unpaid", currency: "USD", dueDate: "2026-10-12" }, 500),
    inv({ display: "partial", currency: "USD", dueDate: "2026-10-09" }, 300),
    inv({ display: "overdue", currency: "USD", dueDate: "2026-09-25" }, 200),
    inv({ display: "overdue", currency: "PKR", dueDate: "2026-09-05" }, 9000),
    inv({ display: "paid", currency: "PKR", payments: [pay("2026-10-02", 4000), pay("2026-09-20", 1)] }, 4000),
  ];
  const by = stagesByCurrency(views, [hourly("a", "USD", 6000), hourly("b", "PKR", 100000)], [te("a", 90), te("a", 30, { billable: false }), te("b", 60, { invoiceId: "x" })], TODAY);

  it("keeps every currency separate", () => {
    expect(by.USD?.drafted).toEqual({ amount: 800, count: 1 });
    expect(by.USD?.out).toEqual({ amount: 800, count: 2, nextDue: "2026-10-09" });
    expect(by.USD?.late).toEqual({ amount: 200, count: 1, oldestDays: 10 });
    expect(by.USD?.owed).toBe(1000);
    expect(by.PKR?.late.amount).toBe(9000);
    expect(by.PKR?.owed).toBe(9000);
  });
  it("counts unbilled billable hourly time only", () => {
    expect(by.USD?.unbilled).toMatchObject({ amount: 9000, minutes: 90, count: 1 });
    expect(by.PKR?.unbilled.amount).toBe(0);
  });
  it("counts payments landed this month only", () => {
    expect(by.PKR?.landed).toEqual({ amount: 4000, count: 1 });
    expect(by.USD?.landed.count).toBe(0);
  });
  it("orders active currencies with base first and falls back to base", () => {
    expect(activeCurrencies(by, "PKR")).toEqual(["PKR", "USD"]);
    expect(activeCurrencies({}, "PKR")).toEqual(["PKR"]);
  });
});

describe("sentToPaidDays", () => {
  it("averages issue to last payment over paid invoices", () => {
    const v = [
      inv({ display: "paid", issueDate: "2026-09-01", payments: [pay("2026-09-11", 1)] }),
      inv({ display: "paid", issueDate: "2026-09-01", payments: [pay("2026-09-05", 1), pay("2026-09-25", 1)] }),
      inv({ display: "unpaid" }),
    ];
    expect(sentToPaidDays(v)).toEqual({ days: 17, n: 2 });
    expect(sentToPaidDays([inv({ display: "unpaid" })])).toBeNull();
  });
});

const at = (h: number, m: number) => new Date(2026, 9, 5, h, m).toISOString();

describe("day strip", () => {
  it("has 48 slots between 08:00 and 20:00", () => expect(SLOT_COUNT).toBe(48));

  it("places timer-saved entries ending at their save time", () => {
    const segs = entrySegments([{ minutes: 60, updatedAt: at(10, 0), key: "c1" }], TODAY);
    expect(segs).toEqual([{ startMin: 540, endMin: 600, key: "c1" }]);
    const slots = bucketDayStrip(segs);
    expect(slots.filter(Boolean)).toHaveLength(4);
    expect(slots[4]).toEqual({ kind: "entry", key: "c1" });
    expect(slots[3]).toBeNull();
    expect(slots[8]).toBeNull();
  });

  it("lays out entries not saved today end to end from 08:00 and resolves overlaps", () => {
    const loose = entrySegments([{ minutes: 30, updatedAt: "2026-10-04T10:00:00Z", key: "a" }, { minutes: 45, updatedAt: "bad", key: "b" }], TODAY);
    expect(loose).toEqual([{ startMin: 480, endMin: 510, key: "a" }, { startMin: 510, endMin: 555, key: "b" }]);
    const overlap = entrySegments([{ minutes: 60, updatedAt: at(10, 0), key: "a" }, { minutes: 60, updatedAt: at(10, 30), key: "b" }], TODAY);
    expect(overlap.map((s) => [s.startMin, s.endMin])).toEqual([[540, 600], [600, 660]]);
  });

  it("uses real start times without moving them", () => {
    const segs = entrySegments([{ minutes: 60, updatedAt: at(18, 0), startTime: "09:00", key: "a" }, { minutes: 60, updatedAt: at(18, 0), startTime: "09:30", key: "b" }], TODAY);
    expect(segs.map((s) => [s.startMin, s.endMin])).toEqual([[540, 600], [570, 630]]);
  });

  it("clips to the window and lets the live span win", () => {
    const slots = bucketDayStrip([{ startMin: 420, endMin: 495, key: "a" }, { startMin: 1190, endMin: 1300, key: "a" }, { startMin: 480, endMin: 510, live: true }]);
    expect(slots[0]).toEqual({ kind: "live" });
    expect(slots[1]).toEqual({ kind: "live" });
    expect(slots[47]).toEqual({ kind: "entry", key: "a" });
    expect(bucketDayStrip([{ startMin: 0, endMin: 400 }]).every((s) => s === null)).toBe(true);
  });

  it("builds the live segment from the timer start", () => {
    const now = new Date(2026, 9, 5, 11, 20);
    expect(liveSegment(at(9, 5), now, TODAY)).toEqual({ startMin: 545, endMin: 680, live: true });
    expect(liveSegment("2026-10-04T08:00:00", now, TODAY)?.startMin).toBe(0);
  });
});
