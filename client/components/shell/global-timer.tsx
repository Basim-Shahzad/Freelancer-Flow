"use client";

import { Play, Square } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select";
import { projectLabel } from "@/components/time/project-label";
import { useApiToast } from "@/lib/hooks/use-api-toast";
import { formatClock, useElapsed } from "@/lib/hooks/use-elapsed";
import { useClientOptions } from "@/lib/hooks/clients";
import { useProjectOptions } from "@/lib/hooks/projects";
import { useRunningTimer, useStartTimer, useStopTimer } from "@/lib/hooks/time-entries";
import { formatDuration } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Global timer in the top bar, backed by the API (one running entry per user; a second start is a 409 whose
 * message is shown). A project is required to start. Offline, start and stop are kept in the outbox.
 */
export function GlobalTimer({ className, compact }: { className?: string; compact?: boolean }) {
  const { running } = useRunningTimer();
  const { projects } = useProjectOptions();
  const { clients } = useClientOptions();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const { error } = useApiToast();
  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");
  const elapsed = useElapsed(running?.startAt, Boolean(running));

  const active = projects.filter((p) => p.status === "active" || p.status === "draft" || p.status === "paused");
  const label = (id: string) => {
    const p = projects.find((x) => x.id === id);
    return p ? projectLabel(p, clients) : "";
  };
  const busy = startTimer.isPending || stopTimer.isPending;

  const start = () => {
    startTimer.mutate(
      { projectId, description: description.trim() || "Untitled" },
      {
        onSuccess: (r) => {
          setDescription("");
          if (r.queued) toast.success("Timer started", { description: "Kept on this device. It uploads when you’re back online." });
        },
        onError: (e) => error(e, "Couldn’t start the timer"),
      },
    );
  };

  const stop = () => {
    if (!running) return;
    stopTimer.mutate(
      { entry: running },
      {
        onSuccess: (r) => toast.success(`Saved ${formatDuration(r.entry.minutes)}`, {
          description: r.queued ? "Kept on this device. It uploads when you’re back online." : label(r.entry.projectId ?? ""),
        }),
        onError: (e) => error(e, "Couldn’t stop the timer"),
      },
    );
  };

  const shownProject = running ? running.projectId ?? "" : projectId;
  const options = running && !active.some((p) => p.id === shownProject)
    ? [...active, ...projects.filter((p) => p.id === shownProject)]
    : active;

  return (
    <div role="group" aria-label="Global timer" className={cn("flex min-w-0 flex-wrap items-center gap-3", className)}>
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full bg-muted-foreground", running && "bg-primary animate-[pulse-dot_1.6s_ease-in-out_infinite]")} />
      <Label className="sr-only" htmlFor="gt-project">Project</Label>
      <SelectField
        id="gt-project" value={shownProject} onValueChange={setProjectId} disabled={Boolean(running)}
        placeholder="Choose a project…"
        options={options.map((p) => ({ value: p.id, label: projectLabel(p, clients) }))}
        className={cn("min-h-10 w-auto min-w-0 flex-[0_1_13rem] text-sm", compact && "flex-1")}
      />
      <Label className="sr-only" htmlFor="gt-desc">Description</Label>
      <Input
        id="gt-desc" value={running ? running.description : description} readOnly={Boolean(running)}
        onChange={(e) => setDescription(e.target.value)} placeholder="What are you working on?"
        className={cn("min-h-10 min-w-0 flex-[1_1_10rem] text-sm", compact && "hidden sm:block")}
      />
      <span role="timer" aria-label="Elapsed time" className="num min-w-[5.5ch] font-serif text-lg">{formatClock(elapsed)}</span>
      <Button
        size="sm" variant={running ? "outline" : "primary"} onClick={running ? stop : start}
        disabled={busy || (!running && !projectId)} loading={busy} className="min-h-10"
      >
        {running ? <Square fill="currentColor" aria-hidden="true" /> : <Play fill="currentColor" aria-hidden="true" />}
        {running ? "Stop" : "Start"}
      </Button>
    </div>
  );
}
