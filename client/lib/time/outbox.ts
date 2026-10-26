import { MAX_BATCH, type TimeEntryResponse, type TimeEntrySyncResult } from "@/lib/api/time-entries.types";
import { isoDate, localHHMM } from "@/lib/dates";
import type { TimeEntry } from "@/lib/types";

/**
 * Pure logic of the offline time outbox. Every operation made while offline (or when the network drops) is folded
 * into one `QueuedEntry` per entry id, in the order the entries were first touched, and replayed through
 * `POST /time-entries/sync`. Nothing here touches the network, the clock or storage.
 */

/** One entry as the outbox holds it: the state the user last left it in. */
export interface QueuedEntry {
  /** Client-generated UUID for entries born offline; the server id for edits and deletes of known entries. */
  id: string;
  projectId: string;
  milestoneId?: string;
  description: string;
  billable: boolean;
  startAt: string;
  /** null while the (offline) timer is still running. */
  endAt: string | null;
  /** The server `updatedAt` this edit is based on; absent for entries the server has never seen. */
  seenUpdatedAt?: string;
  deleted: boolean;
  queuedAt: string;
}

/** The fields an operation carries; the outbox fills in the rest. */
export type EntrySnapshot = Pick<QueuedEntry, "id" | "projectId" | "milestoneId" | "description" | "billable" | "startAt"> & {
  seenUpdatedAt?: string;
};

export type OutboxOp =
  | { type: "start"; entry: EntrySnapshot }
  | { type: "stop"; entry: EntrySnapshot; endAt: string }
  | { type: "log"; entry: EntrySnapshot; endAt: string }
  | { type: "update"; entry: EntrySnapshot; endAt: string | null }
  | { type: "delete"; entry: EntrySnapshot; endAt: string | null };

export function snapshotOf(e: TimeEntry): EntrySnapshot {
  return {
    id: e.id, projectId: e.projectId ?? "", milestoneId: e.milestoneId, description: e.description, billable: e.billable,
    startAt: e.startAt ?? new Date(`${e.date}T${e.startTime ?? "09:00"}:00`).toISOString(), seenUpdatedAt: e.updatedAt,
  };
}

/**
 * Folds one operation into the queue. Operations on the same id are coalesced into one item that keeps its
 * position (so replay order is the order entries were first touched) and keeps the server version it was first
 * based on. Deleting an entry the server never saw simply removes it.
 */
export function enqueue(queue: QueuedEntry[], op: OutboxOp, now: string): QueuedEntry[] {
  const i = queue.findIndex((q) => q.id === op.entry.id);
  const existing = i >= 0 ? queue[i] : undefined;
  const seenUpdatedAt = existing ? existing.seenUpdatedAt : op.entry.seenUpdatedAt;

  if (op.type === "delete") {
    if (existing && existing.seenUpdatedAt === undefined) return queue.filter((q) => q.id !== op.entry.id);
    const item: QueuedEntry = { ...op.entry, endAt: op.endAt, seenUpdatedAt, deleted: true, queuedAt: now };
    return existing ? queue.map((q, n) => (n === i ? item : q)) : [...queue, item];
  }

  const endAt = op.type === "start" ? null : op.endAt;
  const item: QueuedEntry = { ...op.entry, endAt, seenUpdatedAt, deleted: false, queuedAt: now };
  return existing ? queue.map((q, n) => (n === i ? item : q)) : [...queue, item];
}

/** Batches of at most `size` items, in order. The server takes 200 per call. */
export function chunk<T>(items: readonly T[], size: number = MAX_BATCH): T[][] {
  const out: T[][] = [];
  for (let n = 0; n < items.length; n += size) out.push(items.slice(n, n + size));
  return out;
}

/** A queued item the server refused because it changed elsewhere (or is locked / owned by someone else). */
export interface SyncConflict {
  item: QueuedEntry;
  reason: string;
  /** The server copy, when the server sent one. */
  server: TimeEntryResponse | null;
}

/** A queued item that failed validation (end before start, in the future, longer than 24 h, ...). */
export interface RejectedItem {
  item: QueuedEntry;
  reason: string;
}

export interface AppliedResults {
  /** Items the server did not answer for; they stay queued. */
  remaining: QueuedEntry[];
  /** Server copies of created / updated entries, to reconcile into the cache. */
  entries: TimeEntryResponse[];
  deletedIds: string[];
  conflicts: SyncConflict[];
  rejected: RejectedItem[];
  /** Ids the server flagged as overlapping another entry (non-blocking). */
  overlaps: string[];
}

/**
 * Handles every result of one sync batch separately (the batch never fails as a whole):
 * `created` / `updated` / `deleted` leave the queue, `conflict` and `rejected` move to their own lists for the user
 * to decide, and a `warning: "overlap"` is reported without blocking anything.
 */
export function applyResults(sent: QueuedEntry[], results: TimeEntrySyncResult[]): AppliedResults {
  const byId = new Map(results.map((r) => [r.id, r]));
  const out: AppliedResults = { remaining: [], entries: [], deletedIds: [], conflicts: [], rejected: [], overlaps: [] };
  for (const item of sent) {
    const r = byId.get(item.id);
    if (!r) { out.remaining.push(item); continue; }
    if (r.status === "created" || r.status === "updated") {
      if (r.entry) out.entries.push(r.entry);
      if (r.warning === "overlap") out.overlaps.push(item.id);
    } else if (r.status === "deleted") {
      out.deletedIds.push(item.id);
    } else if (r.status === "conflict") {
      out.conflicts.push({ item, reason: r.reason ?? "changed_elsewhere", server: r.entry });
    } else {
      out.rejected.push({ item, reason: r.reason ?? "Rejected by the server" });
    }
  }
  return out;
}

/** A human sentence for a conflict reason from the server (unknown reasons are shown as sent). */
export function conflictText(reason: string): string {
  const known: Record<string, string> = {
    server_newer: "This entry was changed on another device after you last saw it.",
    already_running: "Another timer is already running.",
    invoiced: "This entry is on an invoice, so it is locked.",
    not_found: "The server doesn’t have this entry.",
    foreign_id: "This entry belongs to someone else.",
  };
  return known[reason] ?? reason.replaceAll("_", " ");
}

/** The queue item as a time entry for lists and the week grid (`unsynced`). Running items have no minutes. */
export function queuedToTimeEntry(q: QueuedEntry): TimeEntry {
  const start = new Date(q.startAt);
  const minutes = q.endAt ? Math.max(0, Math.round((new Date(q.endAt).getTime() - start.getTime()) / 60_000)) : 0;
  return {
    id: q.id, projectId: q.projectId, milestoneId: q.milestoneId, description: q.description, date: isoDate(start), startTime: localHHMM(start),
    startAt: q.startAt, endAt: q.endAt ?? undefined, minutes, billable: q.billable, isInvoiced: false, unsynced: true, updatedAt: q.queuedAt,
  };
}

/** Server entries with the queue laid over them: edits replace, deletes hide, new items are added. Running items are left out. */
export function mergeOutbox(entries: TimeEntry[], queue: QueuedEntry[]): TimeEntry[] {
  if (queue.length === 0) return entries;
  const byId = new Map(queue.map((q) => [q.id, q]));
  const seen = new Set<string>();
  const out: TimeEntry[] = [];
  for (const e of entries) {
    const q = byId.get(e.id);
    seen.add(e.id);
    if (!q) out.push(e);
    else if (!q.deleted && q.endAt) out.push({ ...queuedToTimeEntry(q), isInvoiced: e.isInvoiced, overlap: e.overlap });
  }
  for (const q of queue) if (!seen.has(q.id) && !q.deleted && q.endAt) out.push(queuedToTimeEntry(q));
  return out;
}

/** The running timer, given the server's and the queue: a queued stop ends it, a queued start (offline) is it. */
export function resolveRunning(server: TimeEntry | null, queue: QueuedEntry[]): TimeEntry | null {
  if (server) {
    const q = queue.find((x) => x.id === server.id);
    if (q && (q.endAt || q.deleted)) return null;
    return server;
  }
  const started = queue.find((q) => !q.deleted && q.endAt === null);
  return started ? { ...queuedToTimeEntry(started), unsynced: true } : null;
}
