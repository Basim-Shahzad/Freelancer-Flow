"use client";

import Link from "next/link";
import { useMemo } from "react";
import { format, startOfWeek } from "date-fns";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHead } from "@/components/ui/section";
import { clientHue } from "@/lib/client-hue";
import { isoDate, parse } from "@/lib/dates";
import { formatClock, useElapsed } from "@/lib/hooks/use-elapsed";
import { formatDuration, formatHours, formatMoney } from "@/lib/money";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { bucketDayStrip, entrySegments, liveSegment } from "./day-strip";

/** "Today" card: running timer (start / stop / edit via the store), day strip, and week stats. */
export function TodayCard({ today, unbilledMinutes, className }: { today: string; unbilledMinutes: number; className?: string }) {
  const timer = useAppStore((s) => s.timer);
  const projects = useAppStore((s) => s.projects);
  const clients = useAppStore((s) => s.clients);
  const time = useAppStore((s) => s.time);
  const stop = useAppStore((s) => s.stopTimer);
  const start = useAppStore((s) => s.startTimer);
  const elapsed = useElapsed(timer.startedAt, timer.running);

  const project = projects.find((p) => p.id === timer.projectId);
  const client = clients.find((c) => c.id === project?.clientId);
  const where = project ? `${client?.name ?? "Client"} · ${project.name}` : "No project";
  const rate = project?.billingType === "hourly" && project.hourlyRate !== undefined ? project.hourlyRate : undefined;

  const stats = useMemo(() => {
    const clientIds = clients.map((c) => c.id);
    const hourlyIds = new Set(projects.filter((p) => p.billingType === "hourly").map((p) => p.id));
    const runningMin = timer.running ? Math.floor(elapsed / 60) : 0;
    const now = timer.running && timer.startedAt ? new Date(new Date(timer.startedAt).getTime() + elapsed * 1000) : new Date();
    const weekFrom = isoDate(startOfWeek(parse(today), { weekStartsOn: 1 }));
    const todays = time.filter((t) => t.date === today);
    const sum = (list: { minutes: number }[]) => list.reduce((a, t) => a + t.minutes, 0);
    const slots = bucketDayStrip([
      ...entrySegments(todays.map((t) => ({ minutes: t.minutes, updatedAt: t.updatedAt, startTime: t.startTime, key: projects.find((p) => p.id === t.projectId)?.clientId })), today)
        .map((s) => ({ ...s, key: s.key ? clientHue(s.key, clientIds) : undefined })),
      ...(timer.running && timer.startedAt ? [liveSegment(timer.startedAt, now, today)].filter((s) => s !== null) : []),
    ]);
    const timerHourly = timer.running && !!timer.projectId && hourlyIds.has(timer.projectId);
    return {
      slots,
      logged: sum(todays) + runningMin,
      hourly: sum(todays.filter((t) => t.projectId && hourlyIds.has(t.projectId))) + (timerHourly ? runningMin : 0),
      week: sum(time.filter((t) => t.date >= weekFrom && t.date <= today)) + runningMin,
    };
  }, [clients, projects, time, timer.running, timer.startedAt, timer.projectId, elapsed, today]);

  const onStop = () => {
    const e = stop();
    if (e) toast.success(`Saved ${formatDuration(e.minutes)}`, { description: where });
  };

  const statCells = [
    ...(rate !== undefined && project ? [{ v: <>{formatMoney(rate, project.currency)}</>, k: "Hourly rate on this project" }] : []),
    { v: <>{formatHours(stats.week)}</>, k: "This week" },
  ];

  return (
    <Card className={className}>
      <section aria-labelledby="d-today">
        <CardHead title={<span id="d-today">Today</span>} sub={format(parse(today), "EEEE d MMMM")} />
        <CardBody className="flex flex-col gap-5 pb-5">
          <div className="@container">
            <div className="flex min-w-0 items-center gap-3">
              <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full bg-muted-foreground", timer.running && "bg-success animate-[pulse-dot_1.6s_ease-in-out_infinite]")} />
              <div role="timer" aria-label={timer.running ? "Timer running, elapsed time" : "Timer stopped, elapsed time"} className={cn("num min-w-0 font-serif text-[clamp(1.5rem,11cqi,2rem)] font-medium leading-none tracking-[-0.02em]", !timer.running && "text-muted-foreground")}>{formatClock(elapsed)}</div>
            </div>
            <div className="mt-2 ps-5">
              <div className="text-sm font-semibold leading-snug">{where}</div>
              <div className="text-xs leading-snug text-muted-foreground">{timer.description || "No description"}{timer.running ? " · billable" : " · timer stopped"}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 ps-5">
              {timer.running ? (
                <>
                  <Button variant="outline" size="sm" onClick={onStop}>Stop</Button>
                  <Button variant="ghost" size="sm" asChild><Link href="/time">Edit entry</Link></Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => start()}><Play fill="currentColor" aria-hidden="true" />Start timer</Button>
              )}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
              <span><b className="num font-semibold text-foreground">{formatDuration(stats.logged)}</b> logged</span>
              <span><span className="num">{formatDuration(stats.hourly)}</span> on hourly projects</span>
            </div>
            <div role="img" aria-label={`Day strip, 08:00 to 20:00: ${formatDuration(stats.logged)} logged today${timer.running ? ", timer running" : ""}`} className="flex h-7 gap-0.5">
              {stats.slots.map((slot, i) => (
                <span
                  key={i}
                  className={cn("flex-1 rounded-[2px] bg-[color-mix(in_srgb,var(--foreground)_7%,var(--background))]", slot?.kind === "live" && "bg-success", slot?.kind === "entry" && !slot.key && "bg-muted-foreground")}
                  style={slot?.kind === "entry" && slot.key ? { background: slot.key } : undefined}
                />
              ))}
            </div>
            <div aria-hidden="true" className="num mt-1.5 flex justify-between text-[0.6875rem] text-muted-foreground"><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span></div>
          </div>

          <dl className={cn("grid gap-px overflow-hidden rounded-lg border border-border bg-border", statCells.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {statCells.map((c) => (
              <div key={c.k} className="flex flex-col-reverse gap-0.5 bg-surface px-3.5 py-3">
                <dt className="text-xs text-muted-foreground">{c.k}</dt>
                <dd className="num font-serif text-lg font-medium leading-tight tracking-tight">{c.v}</dd>
              </div>
            ))}
          </dl>

          {unbilledMinutes > 0 && (
            <Button block asChild><Link href="/time">{formatHours(unbilledMinutes)} still unbilled — see the week</Link></Button>
          )}
        </CardBody>
      </section>
    </Card>
  );
}
