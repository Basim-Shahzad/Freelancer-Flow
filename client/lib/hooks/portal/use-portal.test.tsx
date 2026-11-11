import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import MockAdapter from "axios-mock-adapter";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { portalInvoiceResponseFixture } from "@/lib/test/invoices";
import { milestoneResponseFixture } from "@/lib/test/projects";
import { createTestQueryClient } from "@/lib/test";
import { portalApi } from "@/lib/services/portal.service";
import { useApproveMilestone, usePortalConvert, usePortalInvoice, usePortalMilestone, usePortalProject } from "./use-portal";

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(portalApi, { onNoMatch: "throwException" }); });
afterEach(() => mock.restore());
const setup = <T,>(hook: () => T) => {
  const qc = createTestQueryClient();
  return { qc, ...renderHook(hook, { wrapper: ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> }) };
};

describe("portal hooks", () => {
  it("fetches the invoice once, no refetch on focus or reconnect", async () => {
    mock.onGet("/portal/invoice/i1").reply(200, portalInvoiceResponseFixture());
    const { result } = setup(() => usePortalInvoice("i1", "tok"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => { window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("online")); });
    await new Promise((r) => setTimeout(r, 30));
    expect(mock.history.get).toHaveLength(1);
  });

  it("does not request without a token and keys exclude it", async () => {
    const { result, qc } = setup(() => usePortalProject("p1", null));
    expect(result.current.fetchStatus).toBe("idle");
    expect(JSON.stringify(qc.getQueryCache().getAll().map((q) => q.queryKey))).not.toContain("tok");
  });

  it.each([401, 403, 404, 429])("surfaces %s without retry", async (s) => {
    mock.onGet("/portal/milestone/m1").reply(s, { detail: "x" });
    const { result } = setup(() => usePortalMilestone("m1", "tok"));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mock.history.get).toHaveLength(1);
  });

  it("approve writes the milestone into the cache; 400 surfaces", async () => {
    mock.onGet("/portal/milestone/m1").reply(200, milestoneResponseFixture({ id: "m1", status: "SUBMITTED" }));
    mock.onPost("/portal/milestone/m1/approve").replyOnce(400, { detail: "Not submitted" }).onPost("/portal/milestone/m1/approve").reply(200, milestoneResponseFixture({ id: "m1", status: "APPROVED" }));
    const { result } = setup(() => ({ m: usePortalMilestone("m1", "tok"), a: useApproveMilestone("m1", "tok") }));
    await waitFor(() => expect(result.current.m.isSuccess).toBe(true));
    await act(async () => { await result.current.a.mutateAsync(undefined).catch(() => undefined); });
    await waitFor(() => expect(result.current.a.isError).toBe(true));
    await act(async () => { await result.current.a.mutateAsync("ok"); });
    await waitFor(() => expect(result.current.m.data?.status).toBe("approved"));
    expect(mock.history.get).toHaveLength(1);
  });

  it("convert reports 422", async () => {
    mock.onPost("/portal/convert").reply(422, { detail: [{ loc: ["body", "password"], msg: "too short", type: "x" }] });
    const { result } = setup(() => usePortalConvert("tok"));
    await act(async () => { await result.current.mutateAsync("short").catch(() => undefined); });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
