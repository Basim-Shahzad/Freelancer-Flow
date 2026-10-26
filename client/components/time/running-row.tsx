"use client";

import { Square } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LCell, LedgerRow, LMain, LSub } from "@/components/ui/ledger";
import { Tag } from "@/components/ui/tag";
import { useApiToast } from "@/lib/hooks/use-api-toast";
import { formatClock, useElapsed } from "@/lib/hooks/use-elapsed";
import { useStopTimer } from "@/lib/hooks/time-entries";
import { formatDuration } from "@/lib/money";
import type { TimeEntry } from "@/lib/types";
import { ENTRY_COLS } from "./entry-row";

/** Whole minutes elapsed on the running timer, refreshed every 15 s (cheap for day/week totals). */
export function useRunningMinutes(startedAt: string | undefined, running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [running]);
  if (!running || !startedAt) return 0;
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60_000));
}

export function RunningBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-primary-ink">
      <span aria-hidden="true" className="size-2 rounded-full bg-primary motion-safe:animate-pulse" />Running
    </span>
  );
}

/** The live timer entry, from the API. It becomes a normal entry when stopped. */
export function RunningRow({ entry, project }: { entry: TimeEntry; project: string }) {
  const stopTimer = useStopTimer();
  const { error } = useApiToast();
  const seconds = useElapsed(entry.startAt, true);
  const stop = () =>
    stopTimer.mutate({ entry }, {
      onSuccess: (r) => toast.success(`Saved ${formatDuration(r.entry.minutes)}`, { description: r.queued ? "Kept on this device. It uploads when you’re back online." : project }),
      onError: (e) => error(e, "Couldn’t stop the timer"),
    });
  return (
    <LedgerRow cols={ENTRY_COLS}>
      <LCell>
        <LMain>{entry.description || "Untitled"}</LMain>
        <LSub className="flex flex-wrap items-center gap-x-2">{project}<span aria-hidden="true">·</span><RunningBadge /></LSub>
      </LCell>
      <LCell narrow="hide"><Tag>{entry.billable ? "Billable" : "Non-billable"}</Tag></LCell>
      <LCell narrow="hide"><div className="flex flex-wrap gap-1.5">{entry.unsynced && <Tag tone="warning">Unsynced</Tag>}</div></LCell>
      <LCell end className="flex items-center justify-end gap-1">
        <span className="num font-semibold" aria-label="Elapsed time">{formatClock(seconds)}</span>
        <Button variant="ghost" size="icon-sm" aria-label="Stop timer" disabled={stopTimer.isPending} onClick={stop}><Square aria-hidden="true" /></Button>
      </LCell>
    </LedgerRow>
  );
}
