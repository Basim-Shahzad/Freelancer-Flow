"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { responseToTimeEntry } from "@/lib/api/mappers/time-entries";
import { fmtDateTime } from "@/lib/dates";
import { flushOutbox, timeKeys } from "@/lib/hooks/time-entries";
import { formatDuration } from "@/lib/money";
import { conflictText, queuedToTimeEntry, type RejectedItem, type SyncConflict } from "@/lib/time/outbox";
import { useOutbox } from "@/lib/time/outbox-store";

function Side({ eyebrow, description, minutes, billable }: { eyebrow: string; description: string; minutes: number; billable: boolean }) {
  return (
    <div className="flex flex-col gap-2 border-t border-rule py-3">
      <span className="t-eyebrow">{eyebrow}</span>
      <span className="font-semibold leading-snug">{description}</span>
      <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Duration</span><span className="num">{formatDuration(minutes)}</span></div>
      <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Billable</span><span>{billable ? "Yes" : "No"}</span></div>
    </div>
  );
}

/** Reasons a retry can't succeed: the entry is locked, gone, someone else's, or another timer is running. */
const NO_RETRY = new Set(["invoiced", "not_found", "foreign_id", "already_running"]);

/**
 * The oldest sync conflict: this device's version next to the server's copy (when the server sent one), with the
 * server's reason. Keep the server's version, or retry this device's on top of the server's latest.
 */
export function ConflictPanel() {
  const qc = useQueryClient();
  const conflicts = useOutbox((s) => s.conflicts);
  const dismissConflict = useOutbox((s) => s.dismissConflict);
  const requeue = useOutbox((s) => s.requeue);
  const first: SyncConflict | undefined = conflicts[0];
  if (!first) return null;
  const { item, reason, server } = first;
  const mine = queuedToTimeEntry(item);
  const theirs = server ? responseToTimeEntry(server) : null;

  const refresh = () => void qc.invalidateQueries({ queryKey: timeKeys.all });
  const keepServer = () => {
    dismissConflict(item.id);
    refresh();
    toast.success("Kept the server’s version");
  };
  const retry = () => {
    requeue(item, server?.updatedAt);
    void flushOutbox(qc);
    toast.success("Retrying your version");
  };

  return (
    <section aria-labelledby="tm-conf" className="flex flex-col gap-4 border-y border-rule py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="tm-conf" className="t-h3">One entry changed in two places</h2>
        <Tag tone="warning">{conflicts.length} {conflicts.length === 1 ? "conflict" : "conflicts"}</Tag>
      </div>
      <p className="text-sm text-muted-foreground">
        “{item.description}” wasn’t uploaded. {conflictText(reason)} Nothing is lost until you choose.
      </p>
      <div className="grid gap-x-5 @2xl:grid-cols-2">
        <Side eyebrow={`This device · ${fmtDateTime(item.queuedAt)}`} description={item.description} minutes={mine.minutes} billable={item.billable} />
        {theirs && <Side eyebrow={`Server · ${fmtDateTime(theirs.updatedAt)}`} description={theirs.description} minutes={theirs.minutes} billable={theirs.billable} />}
      </div>
      <div className="flex flex-wrap gap-2">
        {server
          ? <Button size="sm" onClick={keepServer}>Keep server</Button>
          : <Button size="sm" onClick={keepServer}>Discard mine</Button>}
        {!NO_RETRY.has(reason) && <Button size="sm" variant="outline" onClick={retry}>Retry mine</Button>}
      </div>
    </section>
  );
}

/** Items the server rejected as invalid (end before start, in the future, longer than 24 h, ...). */
export function RejectedPanel() {
  const qc = useQueryClient();
  const rejected = useOutbox((s) => s.rejected);
  const dismissRejected = useOutbox((s) => s.dismissRejected);
  const requeue = useOutbox((s) => s.requeue);
  if (rejected.length === 0) return null;

  const retry = (r: RejectedItem) => {
    requeue(r.item, r.item.seenUpdatedAt);
    dismissRejected(r.item.id);
    void flushOutbox(qc);
  };

  return (
    <section aria-labelledby="tm-rej" className="flex flex-col gap-3 border-y border-rule py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="tm-rej" className="t-h3">The server couldn’t accept {rejected.length === 1 ? "an entry" : "some entries"}</h2>
        <Tag tone="warning">{rejected.length} rejected</Tag>
      </div>
      <ul className="flex flex-col">
        {rejected.map((r) => (
          <li key={r.item.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-rule py-3 first:border-t-0">
            <div className="min-w-0">
              <p className="font-semibold leading-snug">{r.item.description}</p>
              <p className="text-sm text-muted-foreground">{r.reason}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => retry(r)}>Retry</Button>
              <Button size="sm" variant="ghost" onClick={() => dismissRejected(r.item.id)}>Discard</Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
