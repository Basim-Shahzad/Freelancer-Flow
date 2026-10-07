"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHead } from "@/components/ui/section";
import { format, parse } from "@/lib/dates";
import { clientHue } from "@/lib/client-hue";
import { formatMoney } from "@/lib/money";
import type { Client, Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { amountFor, heatBackground, shortDuration, STATE_LABEL, stateSlices, weekDays, type ProjectRow } from "./week-logic";

/** "This week by project": hours and where the money has got. */
export function ByProjectCard({ rows, projects, clients }: { rows: ProjectRow[]; projects: Project[]; clients: Client[] }) {
  const clientIds = clients.map((c) => c.id);
  return (
    <Card>
      <CardHead title="This week by project" sub="Where the hours went." />
      {rows.length === 0 ? <CardBody><p className="text-sm text-muted-foreground">No entries this week.</p></CardBody> : (
        <ul>
          {rows.map((r) => {
            const p = projects.find((x) => x.id === r.projectId);
            const c = clients.find((x) => x.id === p?.clientId);
            const unbilledValue = p?.billingType === "hourly" && r.byState.unbilled ? amountFor(r.byState.unbilled, p.hourlyRate) : 0;
            const name = p?.name ?? "Internal";
            const body = (
              <>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-semibold">
                    <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: p ? clientHue(p.clientId, clientIds) : "var(--hue-6)" }} />
                    <span className="truncate">{name}</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{c?.name ?? "No client"}</span>
                </span>
                <span className="num text-end font-semibold">{shortDuration(r.minutes)}</span>
                <span className="col-span-2 text-xs text-muted-foreground @md:col-span-1 @md:text-sm">
                  {stateSlices(r.byState).map(([s, m]) => `${shortDuration(m)} ${STATE_LABEL[s]}`).join(" · ")}
                  {unbilledValue > 0 && p && <> · <span className="num">{formatMoney(unbilledValue, p.currency)} unbilled</span></>}
                </span>
              </>
            );
            const cls = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-border px-5 py-3 last:border-b-0 @md:grid-cols-[minmax(0,1.3fr)_5rem_minmax(0,1.6fr)]";
            return (
              <li key={r.projectId ?? "internal"}>
                {p ? <Link href={`/projects/${p.id}`} className={cn(cls, "text-foreground no-underline hover:bg-hover")}>{body}</Link> : <div className={cls}>{body}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const ROW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface HeatProps {
  weeks: string[];
  byDate: Map<string, number>;
  selected: string;
  current: string;
  onSelect: (weekStart: string) => void;
}

/** "Twelve weeks at a glance": 7 rows × 12 week columns; each column is a button that opens that week. */
export function HeatCard({ weeks, byDate, selected, current, onSelect }: HeatProps) {
  return (
    <Card>
      <CardHead title="Twelve weeks at a glance" sub="Hours per day. Choose a week to open it." />
      <CardBody className="overflow-x-auto">
        <div className="flex min-w-[28rem] gap-1">
          <div className="flex flex-col gap-[3px] pt-[1.375rem] text-[0.6875rem] text-muted-foreground" aria-hidden="true">
            {ROW_LABELS.map((l) => <span key={l} className="grid h-5 w-8 items-center">{l}</span>)}
          </div>
          <div className="grid flex-1 grid-cols-12 gap-[3px]">
            {weeks.map((w, i) => {
              const days = weekDays(w);
              const total = days.reduce((s, d) => s + (byDate.get(d) ?? 0), 0);
              const end = days[6] ? format(parse(days[6]), "d MMM") : "";
              const label = `Week of ${format(parse(w), "d MMM")} to ${end}, ${total ? `${shortDuration(total)} logged` : "nothing logged"}${w === current ? ", this week" : ""}`;
              return (
                <Button
                  key={w}
                  variant="bare"
                  aria-label={label}
                  aria-pressed={w === selected}
                  aria-current={w === current ? "date" : undefined}
                  onClick={() => onSelect(w)}
                  className={cn("h-auto min-h-0 min-w-0 flex-col items-stretch justify-start gap-[3px] rounded-md pb-0.5 hover:border-rule", w === selected && "border-foreground")}
                >
                  <span aria-hidden="true" className="h-[1.125rem] truncate text-center text-[0.6875rem] text-muted-foreground">{i % 3 === 0 ? format(parse(w), "d MMM") : ""}</span>
                  {days.map((d) => {
                    const m = byDate.get(d) ?? 0;
                    return <span key={d} aria-hidden="true" title={`${format(parse(d), "EEE d MMM")} · ${m ? shortDuration(m) : "nothing"}`} className="block h-5 rounded-[3px] border border-border" style={{ background: heatBackground(m) }} />;
                  })}
                </Button>
              );
            })}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
