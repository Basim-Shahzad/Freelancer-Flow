"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { fmtDateTime } from "@/lib/dates";
import { formatDuration } from "@/lib/money";
import { useAppStore } from "@/lib/store";
import type { TimeConflict } from "./logic";

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

/**
 * Compares this device with the server copy of an entry (the server copy is simulated, see
 * `serverVersionOf`). Resolution goes through the store's `resolveConflict`.
 */
export function ConflictPanel({ conflicts }: { conflicts: TimeConflict[] }) {
  const resolveConflict = useAppStore((s) => s.resolveConflict);
  const updateTime = useAppStore((s) => s.updateTime);
  const first = conflicts[0];
  if (!first) return null;
  const { entry, server } = first;

  const keep = (mode: "device" | "server" | "both") => {
    if (mode === "device") resolveConflict(entry.id, "device");
    if (mode === "server") {
      updateTime(entry.id, { minutes: server.minutes, billable: server.billable });
      resolveConflict(entry.id, "server");
    }
    if (mode === "both") {
      resolveConflict(entry.id, "both");
      const copy = useAppStore.getState().time.find((t) => t.id !== entry.id && t.description === `${entry.description} (server copy)` && t.date === entry.date);
      if (copy) { updateTime(copy.id, { minutes: server.minutes, billable: server.billable }); resolveConflict(copy.id, "server"); }
    }
    toast.success(mode === "device" ? "Kept this device’s version" : mode === "server" ? "Kept the server’s version" : "Kept both versions");
  };

  return (
    <section aria-labelledby="tm-conf" className="flex flex-col gap-4 border-y border-rule py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="tm-conf" className="t-h3">One entry changed in two places</h2>
        <Tag tone="warning">{conflicts.length} {conflicts.length === 1 ? "conflict" : "conflicts"}</Tag>
      </div>
      <p className="text-sm text-muted-foreground">
        You edited “{entry.description}” on this device while offline. It was also changed on another device. Choose which version to keep. Nothing is lost until you pick.
      </p>
      <div className="grid gap-x-5 @2xl:grid-cols-2">
        <Side eyebrow={`This device · ${fmtDateTime(entry.updatedAt)}`} description={entry.description} minutes={entry.minutes} billable={entry.billable} />
        <Side eyebrow={`Server · ${fmtDateTime(server.updatedAt)}`} description={server.description} minutes={server.minutes} billable={server.billable} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => keep("device")}>Keep this device</Button>
        <Button size="sm" variant="outline" onClick={() => keep("server")}>Keep server</Button>
        <Button size="sm" variant="ghost" onClick={() => keep("both")}>Keep both</Button>
      </div>
    </section>
  );
}
