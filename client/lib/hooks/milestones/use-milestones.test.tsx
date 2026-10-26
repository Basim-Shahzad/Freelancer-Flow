import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getApiErrorStatus } from "@/lib/services/api.service";
import { createTestQueryClient, mockApi, profileFixture, seedAuth } from "@/lib/test";
import { milestoneResponseFixture } from "@/lib/test/projects";
import { applyOrder, milestoneKeys, useCreateMilestone, useDeleteMilestone, useMilestones, useReorderMilestones, useSubmitMilestone, useUpdateMilestone } from "./use-milestones";

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  m = mockApi();
  seedAuth("authenticated");
  m.mock.onGet("/profile").reply(200, profileFixture());
});
afterEach(() => m.restore());

function setup() {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

const rows = [
  milestoneResponseFixture({ id: "a", name: "A", sortOrder: 0 }),
  milestoneResponseFixture({ id: "b", name: "B", sortOrder: 1 }),
  milestoneResponseFixture({ id: "c", name: "C", sortOrder: 2 }),
];
const LIST = "/projects/p1/milestones/";

describe("useMilestones", () => {
  it("loads and maps the milestones in order", async () => {
    m.mock.onGet(LIST).reply(200, { milestones: rows, total: 3 });
    const { result } = renderHook(() => useMilestones("p1", "USD"), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((x) => x.title)).toEqual(["A", "B", "C"]);
  });

  it("does not fetch while disabled", () => {
    const { result } = renderHook(() => useMilestones("p1", "USD", false), { wrapper: setup().wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("reports a 404 and a network error", async () => {
    m.mock.onGet(LIST).replyOnce(404, { detail: "Project not found" });
    const a = renderHook(() => useMilestones("p1", "USD"), { wrapper: setup().wrapper });
    await waitFor(() => expect(a.result.current.isError).toBe(true));
    expect(getApiErrorStatus(a.result.current.error)).toBe(404);
    m.mock.onGet(LIST).networkError();
    const b = renderHook(() => useMilestones("p1", "USD"), { wrapper: setup().wrapper });
    await waitFor(() => expect(b.result.current.isError).toBe(true));
  });
});

describe("mutations", () => {
  it("creates a milestone and refetches the list", async () => {
    m.mock.onGet(LIST).reply(200, { milestones: rows, total: 3 });
    m.mock.onPost("/milestones").reply(201, milestoneResponseFixture({ id: "d", name: "D" }));
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ list: useMilestones("p1", "USD"), create: useCreateMilestone("p1") }), { wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    await act(async () => { await result.current.create.mutateAsync({ name: "D", projectId: "p1" }); });
    await waitFor(() => expect(m.mock.history.get.filter((r) => r.url === LIST)).toHaveLength(2));
  });

  it("is refused with 422 when milestones are not enabled for the project", async () => {
    m.mock.onPost("/milestones").reply(422, { detail: "Milestones are not enabled for this project" });
    const { result } = renderHook(() => useCreateMilestone("p1"), { wrapper: setup().wrapper });
    const err = await act(async () => result.current.mutateAsync({ name: "D", projectId: "p1" }).catch((e: unknown) => e));
    expect(getApiErrorStatus(err)).toBe(422);
  });

  it("updates, and reports a 409 for an invalid status transition", async () => {
    m.mock.onPatch("/milestones/a").replyOnce(200, milestoneResponseFixture({ id: "a", status: "IN_PROGRESS" }));
    m.mock.onPatch("/milestones/a").replyOnce(409, { detail: "Invalid status transition" });
    const { result } = renderHook(() => useUpdateMilestone("p1"), { wrapper: setup().wrapper });
    await act(async () => { await result.current.mutateAsync({ id: "a", body: { status: "IN_PROGRESS" } }); });
    expect(JSON.parse(m.mock.history.patch[0]!.data)).toEqual({ status: "IN_PROGRESS" });
    const err = await act(async () => result.current.mutateAsync({ id: "a", body: { status: "APPROVED" } }).catch((e: unknown) => e));
    expect(getApiErrorStatus(err)).toBe(409);
  });

  it("deletes, and surfaces a 409 for an invoiced milestone", async () => {
    m.mock.onDelete("/milestones/a").replyOnce(204);
    m.mock.onDelete("/milestones/b").replyOnce(409, { detail: "Milestone has been invoiced and cannot be deleted" });
    const { result } = renderHook(() => useDeleteMilestone("p1"), { wrapper: setup().wrapper });
    await act(async () => { await result.current.mutateAsync("a"); });
    const err = await act(async () => result.current.mutateAsync("b").catch((e: unknown) => e));
    expect(getApiErrorStatus(err)).toBe(409);
  });
});

describe("submit", () => {
  it("POSTs the submit and returns the submitted milestone", async () => {
    m.mock.onPost("/milestones/a/submit").reply(200, milestoneResponseFixture({ id: "a", status: "SUBMITTED", submittedAt: "2026-10-01T10:00:00Z" }));
    const { result } = renderHook(() => useSubmitMilestone("p1"), { wrapper: setup().wrapper });
    const out = await act(async () => result.current.mutateAsync("a"));
    expect(out).toMatchObject({ status: "SUBMITTED" });
    expect(m.mock.history.post[0]!.url).toBe("/milestones/a/submit");
    expect(m.mock.history.get.some((r) => r.url?.includes("/submit"))).toBe(false);
  });

  it("surfaces a 409 when the milestone is not in a submittable state, a 403 and a 404", async () => {
    m.mock.onPost("/milestones/a/submit").replyOnce(409, { detail: "Cannot submit milestone in status APPROVED" });
    m.mock.onPost("/milestones/a/submit").replyOnce(403, { detail: "Freelancer profile required" });
    m.mock.onPost("/milestones/a/submit").replyOnce(404, { detail: "Milestone not found" });
    const { result } = renderHook(() => useSubmitMilestone("p1"), { wrapper: setup().wrapper });
    for (const status of [409, 403, 404]) {
      const err = await act(async () => result.current.mutateAsync("a").catch((e: unknown) => e));
      expect(getApiErrorStatus(err)).toBe(status);
    }
  });
});

describe("applyOrder", () => {
  it("reorders rows and renumbers sortOrder", () => {
    const out = applyOrder(rows, ["c", "a", "b"]);
    expect(out.map((r) => [r.id, r.sortOrder])).toEqual([["c", 0], ["a", 1], ["b", 2]]);
  });
});

describe("useReorderMilestones", () => {
  const seeded = () => {
    const { client, wrapper } = setup();
    client.setQueryData(milestoneKeys.list("p1"), rows);
    return { client, wrapper };
  };
  const order = (client: ReturnType<typeof setup>["client"]) => client.getQueryData<typeof rows>(milestoneKeys.list("p1"))!.map((r) => r.id);

  it("PUTs every id in the new order and applies it to the list", async () => {
    m.mock.onPut("/projects/p1/milestones/order").reply(200, { milestones: applyOrder(rows, ["c", "a", "b"]), total: 3 });
    m.mock.onGet(LIST).reply(200, { milestones: applyOrder(rows, ["c", "a", "b"]), total: 3 });
    const { client, wrapper } = seeded();
    const { result } = renderHook(() => useReorderMilestones("p1"), { wrapper });
    await act(async () => { await result.current.mutateAsync(["c", "a", "b"]); });
    expect(JSON.parse(m.mock.history.put[0]!.data)).toEqual({ milestoneIds: ["c", "a", "b"] });
    expect(order(client)).toEqual(["c", "a", "b"]);
  });

  it("updates the list before the server answers", async () => {
    let release: () => void = () => undefined;
    m.mock.onPut("/projects/p1/milestones/order").reply(() => new Promise((resolve) => { release = () => resolve([200, { milestones: [], total: 0 }]); }));
    m.mock.onGet(LIST).reply(200, { milestones: applyOrder(rows, ["b", "a", "c"]), total: 3 });
    const { client, wrapper } = seeded();
    const { result } = renderHook(() => useReorderMilestones("p1"), { wrapper });
    act(() => { result.current.mutate(["b", "a", "c"]); });
    await waitFor(() => expect(order(client)).toEqual(["b", "a", "c"]));
    expect(result.current.isPending).toBe(true);
    await act(async () => { release(); });
  });

  it("rolls back when the server refuses (422)", async () => {
    m.mock.onPut("/projects/p1/milestones/order").reply(422, { detail: "Send every milestone id exactly once" });
    m.mock.onGet(LIST).reply(200, { milestones: rows, total: 3 });
    const { client, wrapper } = seeded();
    const { result } = renderHook(() => useReorderMilestones("p1"), { wrapper });
    const err = await act(async () => result.current.mutateAsync(["c", "a"]).catch((e: unknown) => e));
    expect(getApiErrorStatus(err)).toBe(422);
    await waitFor(() => expect(order(client)).toEqual(["a", "b", "c"]));
  });
});
