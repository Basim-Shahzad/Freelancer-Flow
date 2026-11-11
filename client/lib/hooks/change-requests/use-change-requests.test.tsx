import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getApiErrorStatus } from "@/lib/services/api.service";
import { createTestQueryClient, mockApi, profileFixture, primeAuth } from "@/lib/test";
import { changeRequestResponseFixture } from "@/lib/test/change-requests";
import { useChangeRequests, useCreateChangeRequest, useDecideChangeRequest, useDeleteChangeRequest, useUpdateChangeRequest } from "./use-change-requests";

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  m = mockApi();
  primeAuth("authenticated");
  m.mock.onGet("/profile").reply(200, profileFixture());
});
afterEach(() => m.restore());

function setup() {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

const LIST = "/change-requests";
const rows = [changeRequestResponseFixture({ id: "a", title: "A", estimatedAmount: "10.00" }), changeRequestResponseFixture({ id: "b", title: "B" })];

describe("useChangeRequests", () => {
  it("loads, maps and sends the filters", async () => {
    m.mock.onGet(LIST).reply(200, { changeRequests: rows, total: 2 });
    const { result } = renderHook(() => useChangeRequests({ projectId: "p1", status: "PENDING", limit: 100 }, "USD"), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.changeRequests.map((c) => c.title)).toEqual(["A", "B"]);
    expect(result.current.data?.changeRequests[0]?.estimatedAmount).toBe(1000);
    expect(m.mock.history.get[0]?.params).toEqual({ project_id: "p1", status: "PENDING", limit: 100 });
  });

  it("does not fetch while disabled", () => {
    const { result } = renderHook(() => useChangeRequests({ projectId: "p1" }, "USD", false), { wrapper: setup().wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("reports a 404 and a network error", async () => {
    m.mock.onGet(LIST).replyOnce(404, { detail: "Project not found" });
    const a = renderHook(() => useChangeRequests({ projectId: "p1" }, "USD"), { wrapper: setup().wrapper });
    await waitFor(() => expect(a.result.current.isError).toBe(true));
    expect(getApiErrorStatus(a.result.current.error)).toBe(404);
    m.mock.onGet(LIST).networkError();
    const b = renderHook(() => useChangeRequests({ projectId: "p2" }, "USD"), { wrapper: setup().wrapper });
    await waitFor(() => expect(b.result.current.isError).toBe(true));
  });

  it("recovers from a 401 through the refresh cookie", async () => {
    let calls = 0;
    m.mock.onGet(LIST).reply(() => (++calls === 1 ? [401, { detail: "expired" }] : [200, { changeRequests: rows, total: 2 }]));
    m.refresh.onPost("/auth/refresh").reply(200, { accessToken: "new" });
    const { result } = renderHook(() => useChangeRequests({ projectId: "p1" }, "USD"), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("mutations", () => {
  it("creates and refetches the list", async () => {
    m.mock.onGet(LIST).reply(200, { changeRequests: rows, total: 2 });
    m.mock.onPost(LIST).reply(201, changeRequestResponseFixture({ id: "c" }));
    const { result } = renderHook(() => ({ list: useChangeRequests({ projectId: "p1" }, "USD"), create: useCreateChangeRequest() }), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    await act(async () => { await result.current.create.mutateAsync({ projectId: "p1", title: "C" }); });
    await waitFor(() => expect(m.mock.history.get.filter((r) => r.url === LIST)).toHaveLength(2));
  });

  it("surfaces a 422 on create", async () => {
    m.mock.onPost(LIST).reply(422, { detail: [{ loc: ["body", "title"], msg: "too short", type: "x" }] });
    const { result } = renderHook(() => useCreateChangeRequest(), { wrapper: setup().wrapper });
    const err = await act(async () => result.current.mutateAsync({ projectId: "p1", title: "" }).catch((e: unknown) => e));
    expect(getApiErrorStatus(err)).toBe(422);
  });

  it.each(["APPROVED", "REJECTED", "WITHDRAWN"] as const)("sends %s with its note", async (status) => {
    m.mock.onPatch(`${LIST}/a`).reply(200, changeRequestResponseFixture({ id: "a", status }));
    const { result } = renderHook(() => useDecideChangeRequest(), { wrapper: setup().wrapper });
    await act(async () => { await result.current.mutateAsync({ id: "a", body: { status, decisionNote: "n" } }); });
    expect(JSON.parse(m.mock.history.patch[0]?.data as string)).toEqual({ status, decisionNote: "n" });
  });

  it("reports a 409 when deciding an already-decided row, and a 422 for a note without a decision", async () => {
    m.mock.onPatch(`${LIST}/a`).replyOnce(409, { detail: "Change request already decided" });
    const { result } = renderHook(() => useDecideChangeRequest(), { wrapper: setup().wrapper });
    const e1 = await act(async () => result.current.mutateAsync({ id: "a", body: { status: "APPROVED" } }).catch((e: unknown) => e));
    expect(getApiErrorStatus(e1)).toBe(409);
    m.mock.onPatch(`${LIST}/a`).replyOnce(422, { detail: "decision_note requires a decision" });
    const e2 = await act(async () => result.current.mutateAsync({ id: "a", body: { decisionNote: "x" } }).catch((e: unknown) => e));
    expect(getApiErrorStatus(e2)).toBe(422);
  });

  it("updates and deletes", async () => {
    m.mock.onPatch(`${LIST}/a`).reply(200, changeRequestResponseFixture({ id: "a", title: "N" }));
    m.mock.onDelete(`${LIST}/a`).reply(204);
    const { wrapper } = setup();
    const up = renderHook(() => useUpdateChangeRequest(), { wrapper });
    await act(async () => { await up.result.current.mutateAsync({ id: "a", body: { title: "N" } }); });
    const del = renderHook(() => useDeleteChangeRequest(), { wrapper });
    await act(async () => { await del.result.current.mutateAsync("a"); });
    expect(m.mock.history.delete).toHaveLength(1);
  });
});
