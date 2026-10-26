import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TimeEntrySyncRequest } from "@/lib/api/time-entries.types";
import { createTestQueryClient, mockApi, seedAuth } from "@/lib/test";
import { runningEntryFixture, syncResultFixture, timeEntryResponseFixture } from "@/lib/test/time-entries";
import { useAppStore } from "@/lib/store";
import { enqueue, type OutboxOp, type QueuedEntry } from "@/lib/time/outbox";
import { useOutbox } from "@/lib/time/outbox-store";
import { timeKeys } from "./keys";
import { flushOutbox } from "./sync";
import { useTimeSync } from "./use-sync";

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  m = mockApi();
  seedAuth("authenticated");
  useOutbox.getState().reset();
  localStorage.clear();
  useAppStore.setState({ online: true });
});
afterEach(() => m.restore());

const op = (id: string, over: Partial<OutboxOp["entry"]> = {}): OutboxOp => ({
  type: "log", entry: { id, projectId: "p1", description: `d ${id}`, billable: true, startAt: "2026-10-05T09:00:00.000Z", ...over }, endAt: "2026-10-05T10:00:00.000Z",
});
const seed = (ids: string[]) => {
  let items: QueuedEntry[] = [];
  for (const id of ids) items = enqueue(items, op(id), "2026-10-05T10:00:00.000Z");
  useOutbox.setState({ items });
};
const created = (id: string) => syncResultFixture({ id, status: "created", entry: timeEntryResponseFixture({ id }) });
const sentBodies = () => m.mock.history.post.filter((r) => r.url === "/time-entries/sync").map((r) => JSON.parse(r.data as string) as TimeEntrySyncRequest);

describe("flushOutbox", () => {
  it("replays in order and clears the queue", async () => {
    seed(["a", "b", "c"]);
    m.mock.onPost("/time-entries/sync").reply((c) => [200, { results: (JSON.parse(c.data as string) as TimeEntrySyncRequest).entries.map((e) => created(e.id)) }]);
    const qc = createTestQueryClient();
    expect(await flushOutbox(qc)).toBe(3);
    expect(sentBodies()[0]!.entries.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(useOutbox.getState().items).toEqual([]);
  });

  it("sends 201 items as a batch of 200 then one", async () => {
    seed(Array.from({ length: 201 }, (_, i) => `e${i}`));
    m.mock.onPost("/time-entries/sync").reply((c) => [200, { results: (JSON.parse(c.data as string) as TimeEntrySyncRequest).entries.map((e) => created(e.id)) }]);
    await flushOutbox(createTestQueryClient());
    expect(sentBodies().map((b) => b.entries.length)).toEqual([200, 1]);
    expect(useOutbox.getState().items).toEqual([]);
  });

  it("handles each result on its own: conflict and rejected leave the queue for the user, the rest reconcile", async () => {
    seed(["ok", "clash", "bad", "dup"]);
    m.mock.onPost("/time-entries/sync").reply(200, {
      results: [
        created("ok"),
        syncResultFixture({ id: "clash", status: "conflict", reason: "server_newer" }),
        syncResultFixture({ id: "bad", status: "rejected", reason: "end before start", entry: null }),
        { ...created("dup"), warning: "overlap" },
      ],
    });
    await flushOutbox(createTestQueryClient());
    const s = useOutbox.getState();
    expect(s.items).toEqual([]);
    expect(s.conflicts.map((c) => [c.item.id, c.reason])).toEqual([["clash", "server_newer"]]);
    expect(s.rejected.map((r) => [r.item.id, r.reason])).toEqual([["bad", "end before start"]]);
    expect(s.overlaps).toEqual(["dup"]);
  });

  it("keeps everything queued on a network failure and on a server error", async () => {
    seed(["a", "b"]);
    m.mock.onPost("/time-entries/sync").networkErrorOnce();
    expect(await flushOutbox(createTestQueryClient())).toBe(0);
    expect(useOutbox.getState().items.map((q) => q.id)).toEqual(["a", "b"]);
    m.mock.onPost("/time-entries/sync").replyOnce(500, { detail: "boom" });
    expect(await flushOutbox(createTestQueryClient())).toBe(0);
    expect(useOutbox.getState().items.map((q) => q.id)).toEqual(["a", "b"]);
  });

  it("stops instead of looping when the server answers for nothing", async () => {
    seed(["a"]);
    m.mock.onPost("/time-entries/sync").reply(200, { results: [] });
    expect(await flushOutbox(createTestQueryClient())).toBe(0);
    expect(sentBodies()).toHaveLength(1);
    expect(useOutbox.getState().items).toHaveLength(1);
  });

  it("runs one flush at a time", async () => {
    seed(["a"]);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => { release = r; });
    m.mock.onPost("/time-entries/sync").reply(async () => { await gate; return [200, { results: [created("a")] }]; });
    const qc = createTestQueryClient();
    const first = flushOutbox(qc);
    expect(await flushOutbox(qc)).toBe(0);
    release();
    expect(await first).toBe(1);
    expect(sentBodies()).toHaveLength(1);
  });

  it("keeps an item edited while its batch was in flight", async () => {
    seed(["a"]);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => { release = r; });
    m.mock.onPost("/time-entries/sync").replyOnce(async () => { await gate; return [200, { results: [created("a")] }]; });
    m.mock.onPost("/time-entries/sync").reply(200, { results: [created("a")] });
    const flushing = flushOutbox(createTestQueryClient());
    await new Promise((r) => setTimeout(r, 5));
    useOutbox.getState().enqueue({ ...op("a", { description: "edited meanwhile" }), type: "update", endAt: "2026-10-05T10:00:00.000Z" } as OutboxOp);
    release();
    await flushing;
    expect(sentBodies().map((b) => b.entries[0]!.description)).toEqual(["d a", "edited meanwhile"]);
    expect(useOutbox.getState().items).toEqual([]);
  });

  it("puts a synced running entry into the running-timer cache and clears it after a stop", async () => {
    const qc = new QueryClient();
    seed(["r"]);
    m.mock.onPost("/time-entries/sync").replyOnce(200, { results: [syncResultFixture({ id: "r", status: "created", entry: runningEntryFixture({ id: "r" }) })] });
    await flushOutbox(qc);
    expect(qc.getQueryData(timeKeys.running())).toMatchObject({ id: "r", isRunning: true });
    seed(["r"]);
    m.mock.onPost("/time-entries/sync").replyOnce(200, { results: [syncResultFixture({ id: "r", status: "updated", entry: timeEntryResponseFixture({ id: "r" }) })] });
    await flushOutbox(qc);
    expect(qc.getQueryData(timeKeys.running())).toBeNull();
  });
});

describe("persistence", () => {
  it("round-trips the queue through localStorage", async () => {
    seed(["a", "b"]);
    useOutbox.setState({ overlaps: ["a"] });
    const raw = localStorage.getItem("paylancr-time-outbox");
    expect(raw).toBeTruthy();
    useOutbox.setState({ items: [], overlaps: [] });
    localStorage.setItem("paylancr-time-outbox", raw as string);
    await useOutbox.persist.rehydrate();
    expect(useOutbox.getState().items.map((q) => q.id)).toEqual(["a", "b"]);
    expect(useOutbox.getState().overlaps).toEqual(["a"]);
  });
});

describe("useTimeSync", () => {
  it("flushes on mount when online and again when the browser comes back online", async () => {
    m.mock.onPost("/time-entries/sync").reply((c) => [200, { results: (JSON.parse(c.data as string) as TimeEntrySyncRequest).entries.map((e) => created(e.id)) }]);
    useAppStore.setState({ online: false });
    seed(["a"]);
    localStorage.setItem("paylancr-time-outbox", JSON.stringify({ state: { items: useOutbox.getState().items, conflicts: [], rejected: [], overlaps: [] }, version: 1 }));
    const qc = createTestQueryClient();
    renderHook(() => useTimeSync(), { wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> });
    expect(sentBodies()).toHaveLength(0);
    useAppStore.setState({ online: true });
    await waitFor(() => expect(useOutbox.getState().items).toEqual([]));
    expect(sentBodies()).toHaveLength(1);
  });
});
