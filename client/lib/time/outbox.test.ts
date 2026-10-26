import { describe, expect, it } from "vitest";
import { syncResultFixture, timeEntryFixture, timeEntryResponseFixture } from "@/lib/test/time-entries";
import {
  applyResults, chunk, conflictText, enqueue, mergeOutbox, queuedToTimeEntry, resolveRunning, snapshotOf, type EntrySnapshot, type QueuedEntry,
} from "./outbox";

const snap = (id: string, over: Partial<EntrySnapshot> = {}): EntrySnapshot => ({
  id, projectId: "p1", description: `work ${id}`, billable: true, startAt: "2026-10-05T09:00:00.000Z", ...over,
});
const q = (id: string, over: Partial<QueuedEntry> = {}): QueuedEntry => ({
  ...snap(id), endAt: "2026-10-05T10:00:00.000Z", deleted: false, queuedAt: "2026-10-05T10:00:00.000Z", ...over,
});
const NOW = "2026-10-05T12:00:00.000Z";

describe("enqueue", () => {
  it("keeps entries in the order they were first touched", () => {
    let queue: QueuedEntry[] = [];
    queue = enqueue(queue, { type: "log", entry: snap("a"), endAt: "2026-10-05T10:00:00.000Z" }, NOW);
    queue = enqueue(queue, { type: "log", entry: snap("b"), endAt: "2026-10-05T10:00:00.000Z" }, NOW);
    queue = enqueue(queue, { type: "update", entry: snap("a", { description: "edited" }), endAt: "2026-10-05T10:30:00.000Z" }, NOW);
    expect(queue.map((x) => x.id)).toEqual(["a", "b"]);
    expect(queue[0]).toMatchObject({ description: "edited", endAt: "2026-10-05T10:30:00.000Z" });
  });

  it("coalesces an offline start and stop into one finished entry", () => {
    let queue = enqueue([], { type: "start", entry: snap("a") }, NOW);
    expect(queue[0]!.endAt).toBeNull();
    queue = enqueue(queue, { type: "stop", entry: snap("a"), endAt: "2026-10-05T11:00:00.000Z" }, NOW);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ id: "a", endAt: "2026-10-05T11:00:00.000Z", deleted: false });
    expect(queue[0]!.seenUpdatedAt).toBeUndefined();
  });

  it("keeps the first server version an edit was based on", () => {
    let queue = enqueue([], { type: "update", entry: snap("a", { seenUpdatedAt: "v1" }), endAt: "2026-10-05T10:00:00.000Z" }, NOW);
    queue = enqueue(queue, { type: "update", entry: snap("a", { seenUpdatedAt: "v2", description: "again" }), endAt: "2026-10-05T10:00:00.000Z" }, NOW);
    expect(queue[0]).toMatchObject({ seenUpdatedAt: "v1", description: "again" });
  });

  it("deleting an entry the server never saw removes it from the queue", () => {
    let queue = enqueue([], { type: "log", entry: snap("a"), endAt: "2026-10-05T10:00:00.000Z" }, NOW);
    queue = enqueue(queue, { type: "delete", entry: snap("a"), endAt: "2026-10-05T10:00:00.000Z" }, NOW);
    expect(queue).toEqual([]);
  });

  it("queues a delete of a known entry with the version it was based on", () => {
    const queue = enqueue([], { type: "delete", entry: snap("a", { seenUpdatedAt: "v1" }), endAt: "2026-10-05T10:00:00.000Z" }, NOW);
    expect(queue[0]).toMatchObject({ id: "a", deleted: true, seenUpdatedAt: "v1" });
  });

  it("builds a snapshot from a time entry", () => {
    const s = snapshotOf(timeEntryFixture({ id: "x", startAt: "2026-10-05T09:00:00.000Z", milestoneId: "m1", updatedAt: "v7" }));
    expect(s).toMatchObject({ id: "x", projectId: "p1", milestoneId: "m1", startAt: "2026-10-05T09:00:00.000Z", seenUpdatedAt: "v7" });
  });
});

describe("chunk", () => {
  const items = Array.from({ length: 450 }, (_, i) => i);
  it("splits at 200 and keeps order", () => {
    expect(chunk(items).map((c) => c.length)).toEqual([200, 200, 50]);
    expect(chunk(items).flat()).toEqual(items);
  });
  it("200 is one batch and 201 is two", () => {
    expect(chunk(items.slice(0, 200))).toHaveLength(1);
    expect(chunk(items.slice(0, 201)).map((c) => c.length)).toEqual([200, 1]);
    expect(chunk([])).toEqual([]);
  });
});

describe("applyResults", () => {
  const sent = ["created", "updated", "deleted", "conflict", "rejected", "missing"].map((id) => q(id));
  const applied = applyResults(sent, [
    syncResultFixture({ id: "created", status: "created", warning: "overlap", entry: timeEntryResponseFixture({ id: "created" }) }),
    syncResultFixture({ id: "updated", status: "updated", entry: timeEntryResponseFixture({ id: "updated" }) }),
    syncResultFixture({ id: "deleted", status: "deleted", entry: null }),
    syncResultFixture({ id: "conflict", status: "conflict", reason: "server_newer", entry: timeEntryResponseFixture({ id: "conflict" }) }),
    syncResultFixture({ id: "rejected", status: "rejected", reason: "end_before_start", entry: null }),
  ]);

  it("drops created, updated and deleted items and reconciles their server copies", () => {
    expect(applied.entries.map((e) => e.id)).toEqual(["created", "updated"]);
    expect(applied.deletedIds).toEqual(["deleted"]);
  });
  it("moves a conflict aside with its reason and server copy", () => {
    expect(applied.conflicts).toHaveLength(1);
    expect(applied.conflicts[0]).toMatchObject({ reason: "server_newer", item: { id: "conflict" }, server: { id: "conflict" } });
  });
  it("moves a rejected item aside with its reason", () => {
    expect(applied.rejected).toEqual([{ item: expect.objectContaining({ id: "rejected" }), reason: "end_before_start" }]);
  });
  it("reports an overlap warning without blocking", () => {
    expect(applied.overlaps).toEqual(["created"]);
  });
  it("keeps items the server did not answer for", () => {
    expect(applied.remaining.map((x) => x.id)).toEqual(["missing"]);
  });
});

describe("mergeOutbox", () => {
  const server = [timeEntryFixture({ id: "a" }), timeEntryFixture({ id: "b" })];
  it("returns the server list untouched with an empty queue", () => {
    expect(mergeOutbox(server, [])).toBe(server);
  });
  it("replaces edited entries, hides deleted ones and adds new ones as unsynced", () => {
    const merged = mergeOutbox(server, [q("a", { description: "edited" }), q("b", { deleted: true }), q("c")]);
    expect(merged.map((e) => [e.id, e.unsynced ?? false])).toEqual([["a", true], ["c", true]]);
    expect(merged[0]!.description).toBe("edited");
  });
  it("keeps the invoiced flag of the server copy", () => {
    expect(mergeOutbox([timeEntryFixture({ id: "a", isInvoiced: true })], [q("a")])[0]!.isInvoiced).toBe(true);
  });
  it("does not list a still-running queued entry", () => {
    expect(mergeOutbox([], [q("r", { endAt: null })])).toEqual([]);
  });
});

describe("resolveRunning", () => {
  const server = timeEntryFixture({ id: "r", endAt: undefined });
  it("is the server's running entry when nothing is queued", () => {
    expect(resolveRunning(server, [])).toBe(server);
    expect(resolveRunning(null, [])).toBeNull();
  });
  it("is null after a queued stop or delete", () => {
    expect(resolveRunning(server, [q("r")])).toBeNull();
    expect(resolveRunning(server, [q("r", { deleted: true })])).toBeNull();
  });
  it("is the queued entry when the timer was started offline", () => {
    const r = resolveRunning(null, [q("n", { endAt: null })]);
    expect(r).toMatchObject({ id: "n", unsynced: true, minutes: 0 });
  });
  it("shows an unsynced queued entry with no minutes while running", () => {
    expect(queuedToTimeEntry(q("n", { endAt: null })).endAt).toBeUndefined();
  });
});

describe("conflictText", () => {
  it("explains known reasons and passes unknown ones through", () => {
    expect(conflictText("server_newer")).toMatch(/another device/);
    expect(conflictText("something_new")).toBe("something new");
  });
});
