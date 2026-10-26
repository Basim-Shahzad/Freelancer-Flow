import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getApiErrorStatus } from "@/lib/services/api.service";
import { createTestQueryClient, mockApi, seedAuth } from "@/lib/test";
import { eventResponseFixture, invoiceResponseFixture, paymentResponseFixture, sendResponseFixture } from "@/lib/test/invoices";
import {
  invoiceKeys, useCancelInvoice, useInvoice, useInvoiceEvents, useInvoiceOptions, useInvoicePdf, useInvoices, useRecordPayment,
  useRemindInvoice, useReverseWriteOff, useSendInvoice, useShareLinks, useVoidPayment, useWriteOffInvoice,
} from "./use-invoices";

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  m = mockApi();
  seedAuth("authenticated");
});
afterEach(() => m.restore());

function setup() {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

const listCalls = () => m.mock.history.get.filter((r) => r.url === "/invoices");
const items = (n: number, offset = 0, over = {}) => Array.from({ length: n }, (_, i) => invoiceResponseFixture({ id: `i${offset + i}`, invoiceNumber: `INV-${offset + i}`, ...over }));

describe("useInvoices", () => {
  it("loads the first page and exposes the total", async () => {
    m.mock.onGet("/invoices").reply(200, { invoices: items(2), total: 2 });
    const { result } = renderHook(() => useInvoices(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.invoices.map((i) => i.id)).toEqual(["i0", "i1"]);
    expect(result.current.data?.total).toBe(2);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("returns an empty list, and surfaces errors", async () => {
    m.mock.onGet("/invoices").replyOnce(200, { invoices: [], total: 0 });
    const a = renderHook(() => useInvoices(), { wrapper: setup().wrapper });
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    expect(a.result.current.data).toEqual({ invoices: [], total: 0 });
    m.mock.onGet("/invoices").replyOnce(500, { detail: "boom" });
    const b = renderHook(() => useInvoices(), { wrapper: setup().wrapper });
    await waitFor(() => expect(b.result.current.isError).toBe(true));
    expect(getApiErrorStatus(b.result.current.error)).toBe(500);
  });

  it("sends search, client_id, project_id and the server status, and omits them when empty", async () => {
    m.mock.onGet("/invoices").reply(200, { invoices: [], total: 0 });
    const { result, rerender } = renderHook((f: Parameters<typeof useInvoices>[0]) => useInvoices(f), { wrapper: setup().wrapper, initialProps: {} });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listCalls()[0]!.params).toEqual({ skip: 0, limit: 20 });
    rerender({ search: "INV-1", clientId: "c1", projectId: "p1", status: "overdue" });
    await waitFor(() => expect(listCalls().at(-1)!.params).toMatchObject({ search: "INV-1", client_id: "c1", project_id: "p1", status: "OVERDUE", skip: 0 }));
    rerender({ status: "written_off" });
    await waitFor(() => expect(listCalls().at(-1)!.params).toMatchObject({ status: "WRITTEN_OFF" }));
    rerender({ status: "void" });
    await waitFor(() => expect(listCalls().at(-1)!.params).toMatchObject({ status: "CANCELLED" }));
  });

  it("'unpaid' asks for SENT and PARTIALLY_PAID and merges them", async () => {
    m.mock.onGet("/invoices").reply((config) => {
      const sent = config.params.status === "SENT";
      return [200, { invoices: sent ? items(1, 0, { createdAt: "2026-10-02T00:00:00Z" }) : items(1, 5, { displayStatus: "PARTIALLY_PAID", createdAt: "2026-10-03T00:00:00Z" }), total: 1 }];
    });
    const { result } = renderHook(() => useInvoices({ status: "unpaid" }), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listCalls().map((r) => r.params.status).sort()).toEqual(["PARTIALLY_PAID", "SENT"]);
    expect(result.current.data?.invoices.map((i) => [i.id, i.status])).toEqual([["i5", "partial"], ["i0", "unpaid"]]);
    expect(result.current.data?.total).toBe(2);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("'unpaid' pages each status from its own offset", async () => {
    m.mock.onGet("/invoices").reply((config) => {
      const { status, skip } = config.params as { status: string; skip: number };
      if (status === "SENT") return [200, { invoices: skip === 0 ? items(2, 0) : items(1, 2), total: 3 }];
      return [200, { invoices: skip === 0 ? items(1, 10, { displayStatus: "PARTIALLY_PAID" }) : [], total: 1 }];
    });
    const { result } = renderHook(() => useInvoices({ status: "unpaid", limit: 2 }), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(async () => { await result.current.fetchNextPage(); });
    await waitFor(() => expect(result.current.data?.invoices).toHaveLength(4));
    const last = listCalls().slice(-2);
    expect(last.find((r) => r.params.status === "SENT")!.params.skip).toBe(2);
    expect(last.find((r) => r.params.status === "PARTIALLY_PAID")!.params.skip).toBe(1);
  });

  it("loads more using the skip offset", async () => {
    m.mock.onGet("/invoices").reply((config) => [200, { invoices: Number(config.params.skip) === 0 ? items(2) : items(1, 2), total: 3 }]);
    const { result } = renderHook(() => useInvoices({ limit: 2 }), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(async () => { await result.current.fetchNextPage(); });
    await waitFor(() => expect(result.current.data?.invoices).toHaveLength(3));
    expect(listCalls()[1]!.params).toMatchObject({ skip: 2, limit: 2 });
  });
});

describe("useInvoice / useInvoiceEvents / useInvoiceOptions", () => {
  it("maps the detail with totals from the server", async () => {
    m.mock.onGet("/invoices/inv1").reply(200, invoiceResponseFixture({ displayStatus: "OVERDUE", isOverdue: true }));
    const { result } = renderHook(() => useInvoice("inv1"), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ status: "overdue", total: 100000, balanceDue: 100000 });
  });

  it("reports a 404", async () => {
    m.mock.onGet("/invoices/nope").reply(404, { detail: "Invoice not found" });
    const { result } = renderHook(() => useInvoice("nope"), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getApiErrorStatus(result.current.error)).toBe(404);
  });

  it("lists events in server order", async () => {
    m.mock.onGet("/invoices/inv1/events").reply(200, { events: [eventResponseFixture(), eventResponseFixture({ id: "ev2", eventType: "EMAIL_FAILED", detail: "bounced" })] });
    const { result } = renderHook(() => useInvoiceEvents("inv1"), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((e) => e.type)).toEqual(["SENT", "EMAIL_FAILED"]);
  });

  it("pages through every invoice 100 at a time", async () => {
    m.mock.onGet("/invoices").reply((config) => {
      const skip = Number(config.params.skip);
      return [200, { invoices: items(Math.min(100, 150 - skip), skip), total: 150 }];
    });
    const { result } = renderHook(() => useInvoiceOptions(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.invoices).toHaveLength(150));
    expect(listCalls().map((r) => r.params)).toEqual([{ skip: 0, limit: 100 }, { skip: 100, limit: 100 }]);
  });
});

describe("send and remind", () => {
  it.each(["email", "whatsapp", "link"] as const)("sends by %s and stores the updated invoice", async (channel) => {
    m.mock.onPost("/invoices/inv1/send").reply(200, sendResponseFixture({ invoice: invoiceResponseFixture({ displayStatus: "SENT" }) }));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useSendInvoice(), { wrapper });
    let share;
    await act(async () => { share = await result.current.mutateAsync({ id: "inv1", channel }); });
    expect(JSON.parse(m.mock.history.post[0]!.data)).toEqual({ channel });
    expect(share).toMatchObject({ portalUrl: "https://app.example/i/tok", emailDelivered: true });
    expect(client.getQueryData(invoiceKeys.detail("inv1"))).toBeTruthy();
  });

  it("flags an email that could not be delivered", async () => {
    m.mock.onPost("/invoices/inv1/send").reply(200, sendResponseFixture({ emailDelivered: false }));
    const { result } = renderHook(() => useSendInvoice(), { wrapper: setup().wrapper });
    let share: { emailDelivered: boolean | null } | undefined;
    await act(async () => { share = await result.current.mutateAsync({ id: "inv1", channel: "email" }); });
    expect(share?.emailDelivered).toBe(false);
  });

  it("is idempotent: a second send returns the same links and the same status", async () => {
    m.mock.onPost("/invoices/inv1/send").reply(200, sendResponseFixture({ emailDelivered: null }));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useSendInvoice(), { wrapper });
    let a, b;
    await act(async () => { a = await result.current.mutateAsync({ id: "inv1", channel: "link" }); });
    await act(async () => { b = await result.current.mutateAsync({ id: "inv1", channel: "link" }); });
    expect(b).toEqual(a);
    expect((client.getQueryData(invoiceKeys.detail("inv1")) as { displayStatus: string }).displayStatus).toBe("SENT");
  });

  it("surfaces a 409 on send (cancelled invoice)", async () => {
    m.mock.onPost("/invoices/inv1/send").reply(409, { detail: "A cancelled invoice cannot be sent" });
    const { result } = renderHook(() => useSendInvoice(), { wrapper: setup().wrapper });
    const err = await act(async () => result.current.mutateAsync({ id: "inv1", channel: "email" }).catch((e: unknown) => e));
    expect(getApiErrorStatus(err)).toBe(409);
  });

  it("reminds, and surfaces 409 and 429", async () => {
    m.mock.onPost("/invoices/inv1/remind").replyOnce(200, sendResponseFixture());
    const { result } = renderHook(() => useRemindInvoice(), { wrapper: setup().wrapper });
    await act(async () => { await result.current.mutateAsync({ id: "inv1", channel: "whatsapp" }); });
    m.mock.onPost("/invoices/inv1/remind").replyOnce(409, { detail: "Only sent, unpaid invoices can be reminded" });
    expect(getApiErrorStatus(await act(async () => result.current.mutateAsync({ id: "inv1", channel: "email" }).catch((e: unknown) => e)))).toBe(409);
    m.mock.onPost("/invoices/inv1/remind").replyOnce(429, { detail: "Reminded recently" });
    expect(getApiErrorStatus(await act(async () => result.current.mutateAsync({ id: "inv1", channel: "email" }).catch((e: unknown) => e)))).toBe(429);
  });

  it("fetches share links without touching the cache", async () => {
    m.mock.onGet("/invoices/inv1/share").reply(200, { portalUrl: "p", pdfUrl: "d", whatsappUrl: "w" });
    const { result } = renderHook(() => useShareLinks(), { wrapper: setup().wrapper });
    await act(async () => { await result.current.mutateAsync("inv1"); });
    expect(result.current.data).toEqual({ portalUrl: "p", pdfUrl: "d", whatsappUrl: "w" });
  });
});

describe("lifecycle actions", () => {
  const cases = [
    { name: "cancel", path: "cancel", use: () => useCancelInvoice(), call: (r: { mutateAsync: (v: never) => Promise<unknown> }) => r.mutateAsync("inv1" as never), status: "CANCELLED" },
    { name: "write off", path: "write-off", use: () => useWriteOffInvoice(), call: (r: { mutateAsync: (v: never) => Promise<unknown> }) => r.mutateAsync({ id: "inv1", reason: "Client vanished" } as never), status: "WRITTEN_OFF" },
    { name: "reverse write-off", path: "reverse-write-off", use: () => useReverseWriteOff(), call: (r: { mutateAsync: (v: never) => Promise<unknown> }) => r.mutateAsync("inv1" as never), status: "SENT" },
  ];

  it.each(cases)("$name: success updates the cache, refreshes the lists", async ({ path, use, call, status }) => {
    m.mock.onPost(`/invoices/inv1/${path}`).reply(200, invoiceResponseFixture({ displayStatus: status as "SENT" }));
    m.mock.onGet("/invoices").reply(200, { invoices: items(1), total: 1 });
    const { client, wrapper } = setup();
    const { result } = renderHook(() => ({ list: useInvoices(), action: use() }), { wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    await act(async () => { await call(result.current.action as never); });
    expect((client.getQueryData(invoiceKeys.detail("inv1")) as { displayStatus: string }).displayStatus).toBe(status);
    await waitFor(() => expect(listCalls().length).toBe(2));
  });

  it.each(cases)("$name: an invalid transition is a 409 with the server's message", async ({ path, use, call }) => {
    m.mock.onPost(`/invoices/inv1/${path}`).reply(409, { detail: "Invalid transition" });
    const { result } = renderHook(() => use(), { wrapper: setup().wrapper });
    const err = await act(async () => call(result.current as never).catch((e: unknown) => e));
    expect(getApiErrorStatus(err)).toBe(409);
  });

  it("write-off sends the reason", async () => {
    m.mock.onPost("/invoices/inv1/write-off").reply(200, invoiceResponseFixture({ displayStatus: "WRITTEN_OFF" }));
    const { result } = renderHook(() => useWriteOffInvoice(), { wrapper: setup().wrapper });
    await act(async () => { await result.current.mutateAsync({ id: "inv1", reason: "Client vanished" }); });
    expect(JSON.parse(m.mock.history.post[0]!.data)).toEqual({ reason: "Client vanished" });
  });

  it("write-off with a blank reason is a 422", async () => {
    m.mock.onPost("/invoices/inv1/write-off").reply(422, { detail: [{ loc: ["body", "reason"], msg: "String should have at least 1 character", type: "string_too_short" }] });
    const { result } = renderHook(() => useWriteOffInvoice(), { wrapper: setup().wrapper });
    const err = await act(async () => result.current.mutateAsync({ id: "inv1", reason: "" }).catch((e: unknown) => e));
    expect(getApiErrorStatus(err)).toBe(422);
  });

  it("cancel also refreshes time entries and projects", async () => {
    m.mock.onPost("/invoices/inv1/cancel").reply(200, invoiceResponseFixture({ displayStatus: "CANCELLED" }));
    const { client, wrapper } = setup();
    client.setQueryData(["time", "running"], null);
    client.setQueryData(["projects", "list"], []);
    const { result } = renderHook(() => useCancelInvoice(), { wrapper });
    await act(async () => { await result.current.mutateAsync("inv1"); });
    await waitFor(() => {
      expect(client.getQueryState(["time", "running"])?.isInvalidated).toBe(true);
      expect(client.getQueryState(["projects", "list"])?.isInvalidated).toBe(true);
    });
  });

  it("money and status changes invalidate the activity feed and the dashboard", async () => {
    m.mock.onPost("/invoices/inv1/write-off").reply(200, invoiceResponseFixture());
    const { client, wrapper } = setup();
    client.setQueryData(["activity", "feed"], []);
    client.setQueryData(["dashboard", "summary"], {});
    const { result } = renderHook(() => useWriteOffInvoice(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ id: "inv1", reason: "x" }); });
    await waitFor(() => {
      expect(client.getQueryState(["activity", "feed"])?.isInvalidated).toBe(true);
      expect(client.getQueryState(["dashboard", "summary"])?.isInvalidated).toBe(true);
    });
  });
});

describe("payments", () => {
  it("records a payment and returns the updated invoice", async () => {
    m.mock.onPost("/invoices/inv1/payments").reply(201, invoiceResponseFixture({ displayStatus: "PARTIALLY_PAID", amountPaid: "400.00", balanceDue: "600.00", payments: [paymentResponseFixture()] }));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useRecordPayment(), { wrapper });
    let inv: { status: string; balanceDue: number } | undefined;
    await act(async () => { inv = await result.current.mutateAsync({ id: "inv1", body: { amount: "400.00", method: "CASH" } }); });
    expect(JSON.parse(m.mock.history.post[0]!.data)).toEqual({ amount: "400.00", method: "CASH" });
    expect(inv).toMatchObject({ status: "partial", balanceDue: 60000 });
    expect(client.getQueryData(invoiceKeys.detail("inv1"))).toBeTruthy();
  });

  it("maps a 422 (overpayment) and a 409 (not sent)", async () => {
    m.mock.onPost("/invoices/inv1/payments").replyOnce(422, { detail: [{ loc: ["body", "amount"], msg: "Payment exceeds the balance", type: "value_error" }] });
    const { result } = renderHook(() => useRecordPayment(), { wrapper: setup().wrapper });
    expect(getApiErrorStatus(await act(async () => result.current.mutateAsync({ id: "inv1", body: { amount: "9999.00", method: "CASH" } }).catch((e: unknown) => e)))).toBe(422);
    m.mock.onPost("/invoices/inv1/payments").replyOnce(409, { detail: "Invoice is not open for payments" });
    expect(getApiErrorStatus(await act(async () => result.current.mutateAsync({ id: "inv1", body: { amount: "1.00", method: "CASH" } }).catch((e: unknown) => e)))).toBe(409);
  });

  it("voids a payment", async () => {
    m.mock.onDelete("/invoices/inv1/payments/pay1").reply(200, invoiceResponseFixture({ displayStatus: "SENT" }));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useVoidPayment(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ id: "inv1", paymentId: "pay1" }); });
    expect((client.getQueryData(invoiceKeys.detail("inv1")) as { displayStatus: string }).displayStatus).toBe("SENT");
  });

  it("surfaces a 409 when a payment cannot be voided", async () => {
    m.mock.onDelete("/invoices/inv1/payments/pay1").reply(409, { detail: "Cannot void" });
    const { result } = renderHook(() => useVoidPayment(), { wrapper: setup().wrapper });
    expect(getApiErrorStatus(await act(async () => result.current.mutateAsync({ id: "inv1", paymentId: "pay1" }).catch((e: unknown) => e)))).toBe(409);
  });
});

describe("pdf", () => {
  it("downloads the authenticated PDF as a blob", async () => {
    m.mock.onGet("/invoices/inv1/pdf").reply(200, new Blob(["%PDF-1.4"], { type: "application/pdf" }));
    const { result } = renderHook(() => useInvoicePdf(), { wrapper: setup().wrapper });
    let blob: Blob | undefined;
    await act(async () => { blob = await result.current.mutateAsync("inv1"); });
    expect(blob).toBeInstanceOf(Blob);
    expect(m.mock.history.get[0]!.responseType).toBe("blob");
  });

  it("surfaces a 404", async () => {
    m.mock.onGet("/invoices/gone/pdf").reply(404, { detail: "Invoice not found" });
    const { result } = renderHook(() => useInvoicePdf(), { wrapper: setup().wrapper });
    expect(getApiErrorStatus(await act(async () => result.current.mutateAsync("gone").catch((e: unknown) => e)))).toBe(404);
  });
});
