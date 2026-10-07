import { describe, expect, it } from "vitest";
import type { InvoiceView } from "@/lib/selectors";
import type { Client } from "@/lib/types";
import type { RateRow } from "@/components/projects/rate";
import { avgDaysToPay, clientAccount, clientWorth, daysText, daysToPay, matchesClient, matchesFilter, overdueClientCount, sortClientRows, type ClientRow } from "./logic";

const v = (clientId: string, display: InvoiceView["display"], total: number, paid: number, currency: "USD" | "PKR" = "USD"): InvoiceView =>
  ({ clientId, display, currency, totals: { total, paid, balance: total - paid } } as unknown as InvoiceView);

describe("clientAccount", () => {
  const views = [v("a", "paid", 1000, 1000), v("a", "partial", 500, 200), v("a", "overdue", 300, 0), v("a", "draft", 900, 0), v("b", "unpaid", 100, 0)];
  it("aggregates only that client's billed invoices", () => {
    const a = clientAccount("a", views);
    expect(a.billed).toEqual({ USD: 1800 });
    expect(a.paid).toEqual({ USD: 1200 });
    expect(a.outstanding).toEqual({ USD: 600 });
    expect(a.overdue).toEqual({ USD: 300 });
    expect(a.owes && a.isOverdue).toBe(true);
  });
  it("is clear when nothing is owed", () => {
    const a = clientAccount("c", views);
    expect(a.owes).toBe(false);
    expect(matchesFilter(a, "all")).toBe(true);
    expect(matchesFilter(a, "owes")).toBe(false);
  });
  it("keeps currencies apart", () => {
    expect(clientAccount("a", [v("a", "unpaid", 100, 0, "PKR"), v("a", "unpaid", 50, 0)]).outstanding).toEqual({ PKR: 100, USD: 50 });
  });
});

describe("matchesClient", () => {
  const c = { name: "Harbor Labs", contactName: "Jordan Reyes", city: "Austin", country: "US", email: "j@h.example" } as Client;
  it("searches name, contact and city case-insensitively", () => {
    expect(matchesClient(c, "harbor")).toBe(true);
    expect(matchesClient(c, " AUSTIN ")).toBe(true);
    expect(matchesClient(c, "jordan")).toBe(true);
    expect(matchesClient(c, "karachi")).toBe(false);
    expect(matchesClient(c, "")).toBe(true);
  });
});

const paidView = (clientId: string, issue: string, payDates: string[], total = 100): InvoiceView =>
  ({ clientId, display: "paid", issueDate: issue, currency: "USD", totals: { total, paid: total, balance: 0 }, payments: payDates.map((date) => ({ date, amount: total / payDates.length })) } as unknown as InvoiceView);

describe("days to pay", () => {
  it("is issue date to the last payment on a fully paid invoice", () => {
    expect(daysToPay(paidView("a", "2026-09-01", ["2026-09-05", "2026-09-11"]))).toBe(10);
  });
  it("is null when not fully paid or never paid", () => {
    expect(daysToPay({ ...paidView("a", "2026-09-01", ["2026-09-05"]), totals: { total: 100, paid: 40, balance: 60 } } as unknown as InvoiceView)).toBeNull();
    expect(daysToPay(paidView("a", "2026-09-01", []))).toBeNull();
  });
  it("averages per client, null without paid invoices", () => {
    const views = [paidView("a", "2026-09-01", ["2026-09-11"]), paidView("a", "2026-09-01", ["2026-09-06"]), paidView("b", "2026-09-01", ["2026-09-02"]), v("a", "unpaid", 10, 0)];
    expect(avgDaysToPay(views, "a")).toBe(7.5);
    expect(avgDaysToPay(views)).toBe(5.3);
    expect(avgDaysToPay(views, "zzz")).toBeNull();
    expect(avgDaysToPay([])).toBeNull();
  });
  it("formats days", () => {
    expect(daysText(8)).toBe("8 d");
    expect(daysText(7.5)).toBe("7.5 d");
  });
});

const fee = (currency: "USD" | "PKR", feeAmt: number, minutes: number, rate: number | null = Math.round((feeAmt * 60) / minutes)) =>
  ({ kind: "fee", fee: feeAmt, minutes, rate, project: { currency } } as unknown as RateRow);
const hourly = (currency: "USD" | "PKR", rate: number, minutes: number) => ({ kind: "hourly", fee: null, minutes, rate, project: { currency } } as unknown as RateRow);

describe("clientWorth", () => {
  it("pools fee projects and hourly projects within a currency", () => {
    // 100000 fee over 10 h + 5000/h over 10 h = 150000 / 20 h = 7500
    expect(clientWorth([fee("USD", 100000, 600), hourly("USD", 5000, 600)], "USD")).toEqual({ amount: 7500, currency: "USD" });
  });
  it("never mixes currencies: prefers the client's own, else the first found", () => {
    expect(clientWorth([fee("USD", 100000, 600), fee("PKR", 5000000, 600)], "PKR")).toEqual({ amount: 500000, currency: "PKR" });
    expect(clientWorth([fee("PKR", 5000000, 600)], "USD")).toEqual({ amount: 500000, currency: "PKR" });
  });
  it("is null without usable time", () => {
    expect(clientWorth([], "USD")).toBeNull();
    expect(clientWorth([fee("USD", 100000, 600, null)], "USD")).toBeNull();
    expect(clientWorth([fee("USD", 100000, 30)], "USD")).toBeNull();
  });
});

describe("sortClientRows", () => {
  const row = (id: string, worth: ClientRow["worth"], days: number | null, lifetime: ClientRow["lifetime"]): ClientRow =>
    ({ client: { id, name: id.toUpperCase() } as Client, acc: clientAccount(id, []), worth, days, lifetime });
  const rows = [row("a", { amount: 3000, currency: "USD" }, 30, { USD: 100 }), row("b", { amount: 6000, currency: "USD" }, 5, { USD: 50 }), row("c", null, null, {}), row("d", { amount: 1200000, currency: "PKR" }, 12, { PKR: 3000000 })];
  it("orders by worth per hour, best first, missing last", () => {
    expect(sortClientRows(rows, "worth", "USD").map((r) => r.client.id)).toEqual(["b", "d", "a", "c"]);
  });
  it("orders by pay speed, fastest first", () => {
    expect(sortClientRows(rows, "fastest", "USD").map((r) => r.client.id)).toEqual(["b", "d", "a", "c"]);
  });
  it("orders by lifetime billed using converted amounts for ordering only", () => {
    expect(sortClientRows(rows, "lifetime", "USD").map((r) => r.client.id)).toEqual(["d", "a", "b", "c"]);
  });
  it("counts clients with overdue invoices", () => {
    expect(overdueClientCount([{ acc: clientAccount("a", [v("a", "overdue", 1, 0)]) }, { acc: clientAccount("b", []) }])).toBe(1);
  });
});
