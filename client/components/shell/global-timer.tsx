"use client";

import { Play, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { formatClock, useElapsed } from "@/lib/hooks/use-elapsed";
import { formatDuration } from "@/lib/money";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/** Global timer in the top bar. Persists across reloads; Stop saves a billable time entry. */
export function GlobalTimer({ className, compact }: { className?: string; compact?: boolean }) {
  const timer = useAppStore((s) => s.timer);
  const projects = useAppStore((s) => s.projects);
  const clients = useAppStore((s) => s.clients);
  const start = useAppStore((s) => s.startTimer);
  const stop = useAppStore((s) => s.stopTimer);
  const update = useAppStore((s) => s.updateTimer);
  const elapsed = useElapsed(timer.startedAt, timer.running);

  const active = projects.filter((p) => p.status !== "completed");
  const label = (id: string) => { const p = projects.find((x) => x.id === id); return p ? `${clients.find((c) => c.id === p.clientId)?.name ?? ""} · ${p.name}` : ""; };

  const toggle = () => {
    if (timer.running) {
      const e = stop();
      if (e) toast.success(`Saved ${formatDuration(e.minutes)}`, { description: e.projectId ? label(e.projectId) : "No project" });
    } else start();
  };

  return (
    <div role="group" aria-label="Global timer" className={cn("flex min-w-0 flex-wrap items-center gap-3", className)}>
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full bg-muted-foreground", timer.running && "bg-primary animate-[pulse-dot_1.6s_ease-in-out_infinite]")} />
      <Label className="sr-only" htmlFor="gt-project">Project</Label>
      <SelectField
        id="gt-project" value={timer.projectId ?? ""} onValueChange={(v) => update({ projectId: v || undefined })}
        options={[{ value: "", label: "No project" }, ...active.map((p) => ({ value: p.id, label: label(p.id) }))]}
        className={cn("min-h-10 w-auto min-w-0 flex-[0_1_13rem] text-sm", compact && "flex-1")}
      />
      <Label className="sr-only" htmlFor="gt-desc">Description</Label>
      <Input id="gt-desc" value={timer.description} onChange={(e) => update({ description: e.target.value })} placeholder="What are you working on?" className={cn("min-h-10 min-w-0 flex-[1_1_10rem] text-sm", compact && "hidden sm:block")} />
      <span role="timer" aria-label="Elapsed time" className="num min-w-[5.5ch] font-serif text-lg">{formatClock(elapsed)}</span>
      <Button size="sm" variant={timer.running ? "outline" : "primary"} onClick={toggle} className="min-h-10">
        {timer.running ? <Square fill="currentColor" aria-hidden="true" /> : <Play fill="currentColor" aria-hidden="true" />}
        {timer.running ? "Stop" : "Start"}
      </Button>
    </div>
  );
}
