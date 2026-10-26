import type { QueryClient } from "@tanstack/react-query";
import { MAX_BATCH, type TimeEntryResponse } from "@/lib/api/time-entries.types";
import { toSyncItem } from "@/lib/api/mappers/time-entries";
import { projectKeys } from "@/lib/hooks/projects";
import { timeEntriesService } from "@/lib/services/time-entries.service";
import { applyResults, chunk } from "@/lib/time/outbox";
import { useOutbox } from "@/lib/time/outbox-store";
import { timeKeys } from "./keys";

let flushing = false;

/** Puts the server copies from a sync batch into the cache. A running copy becomes the running timer; an ended or deleted one clears it. */
function reconcile(qc: QueryClient, entries: TimeEntryResponse[], deletedIds: string[]) {
  const running = entries.find((e) => e.isRunning);
  const current = qc.getQueryData<TimeEntryResponse | null>(timeKeys.running());
  if (running) qc.setQueryData(timeKeys.running(), running);
  else if (current && (deletedIds.includes(current.id) || entries.some((e) => e.id === current.id))) qc.setQueryData(timeKeys.running(), null);
}

/**
 * Replays the outbox through `POST /time-entries/sync`, in order, in batches of at most 200. Every result is
 * handled on its own (see `applyResults`). Only one flush runs at a time. A failed request (offline, 5xx) leaves
 * everything queued and stops; nothing is ever dropped because of a network failure.
 * Resolves with the number of items the server answered for.
 */
export async function flushOutbox(qc: QueryClient): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let answered = 0;
  try {
    for (;;) {
      const [batch] = chunk(useOutbox.getState().items, MAX_BATCH);
      if (!batch) break;
      let results;
      try {
        results = await timeEntriesService.sync({ entries: batch.map(toSyncItem) });
      } catch {
        break;
      }
      const applied = applyResults(batch, results);
      useOutbox.getState().applyBatch(batch, applied);
      reconcile(qc, applied.entries, applied.deletedIds);
      const done = batch.length - applied.remaining.length;
      answered += done;
      if (done === 0) break; // the server answered for nothing: stop instead of looping on the same batch
    }
  } finally {
    flushing = false;
    if (answered > 0) {
      await Promise.all([qc.invalidateQueries({ queryKey: timeKeys.all }), qc.invalidateQueries({ queryKey: projectKeys.all })]);
    }
  }
  return answered;
}
