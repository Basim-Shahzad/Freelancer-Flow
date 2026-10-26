"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { enqueue, type AppliedResults, type OutboxOp, type QueuedEntry, type RejectedItem, type SyncConflict } from "./outbox";

interface State {
  /** Operations waiting to be replayed, folded to one item per entry, in first-touched order. */
  items: QueuedEntry[];
  /** Items the server refused as conflicts; they wait for the user's decision. */
  conflicts: SyncConflict[];
  /** Items the server rejected as invalid; the user fixes or discards them. */
  rejected: RejectedItem[];
  /** Entry ids the server flagged as overlapping another entry. */
  overlaps: string[];
}

interface Actions {
  enqueue(op: OutboxOp): void;
  /** Takes the result of one batch: sent items leave the queue unless the server did not answer for them. */
  applyBatch(sent: QueuedEntry[], applied: AppliedResults): void;
  /** Puts an item back in the queue (retry after a conflict) based on the given server version. */
  requeue(item: QueuedEntry, seenUpdatedAt: string | undefined): void;
  dismissConflict(id: string): void;
  dismissRejected(id: string): void;
  dismissOverlap(id: string): void;
  reset(): void;
}

const empty: State = { items: [], conflicts: [], rejected: [], overlaps: [] };

export const useOutbox = create<State & Actions>()(
  persist(
    (set) => ({
      ...empty,
      enqueue: (op) => set((s) => ({ items: enqueue(s.items, op, new Date().toISOString()) })),
      applyBatch: (sent, applied) =>
        set((s) => {
          const sentIds = new Set(sent.map((q) => q.id));
          // Edits made while the batch was in flight are newer than what was sent; keep them.
          const sentByTime = new Map(sent.map((q) => [q.id, q.queuedAt]));
          const unanswered = new Set(applied.remaining.map((q) => q.id));
          const items = s.items.filter((q) => {
            if (!sentIds.has(q.id) || unanswered.has(q.id)) return true;
            return q.queuedAt !== sentByTime.get(q.id);
          });
          const settled = new Set([...applied.conflicts.map((c) => c.item.id), ...applied.rejected.map((r) => r.item.id)]);
          return {
            items,
            conflicts: [...s.conflicts.filter((c) => !settled.has(c.item.id)), ...applied.conflicts],
            rejected: [...s.rejected.filter((r) => !settled.has(r.item.id)), ...applied.rejected],
            overlaps: [...new Set([...s.overlaps, ...applied.overlaps])],
          };
        }),
      requeue: (item, seenUpdatedAt) =>
        set((s) => ({
          items: [...s.items.filter((q) => q.id !== item.id), { ...item, seenUpdatedAt, queuedAt: new Date().toISOString() }],
          conflicts: s.conflicts.filter((c) => c.item.id !== item.id),
        })),
      dismissConflict: (id) => set((s) => ({ conflicts: s.conflicts.filter((c) => c.item.id !== id) })),
      dismissRejected: (id) => set((s) => ({ rejected: s.rejected.filter((r) => r.item.id !== id) })),
      dismissOverlap: (id) => set((s) => ({ overlaps: s.overlaps.filter((x) => x !== id) })),
      reset: () => set(empty),
    }),
    {
      name: "paylancr-time-outbox",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Rehydrated on mount by `useTimeSync`, so server and first client render agree.
      skipHydration: true,
      partialize: ({ items, conflicts, rejected, overlaps }) => ({ items, conflicts, rejected, overlaps }),
    },
  ),
);

/** Items still waiting to upload. */
export const useQueuedCount = () => useOutbox((s) => s.items.length);
