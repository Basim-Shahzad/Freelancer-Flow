"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardFoot, CardHead, PageHeader } from "@/components/ui/section";
import { format, parse, todayISO } from "@/lib/dates";
import { formatHours, formatMoney } from "@/lib/money";
import type { Client, Invoice, Project, TimeEntry, TimerState } from "@/lib/types";
import { WeekAgenda } from "./week-agenda";
import { WeekGrid } from "./week-grid";
import {
  classifyAll, heatWeeks, minutesByDate, moneyList, projectBreakdown, shiftWeek, summarizeWeek, unbilledByProject, weekDays, weekStartOf,
  type UnbilledProject,
} from "./week-logic";
import { buildWeek, type BlockItem } from "./week-model";
import { ByProjectCard, HeatCard } from "./week-panels";
import { WeekLegend } from "./week-parts";

interface Props {
  time: TimeEntry[];
  projects: Project[];
  clients: Client[];
  invoices: Invoice[];
  timer: TimerState;
  /** Page header actions (view toggle, Add time). */
  actions: ReactNode;
  /** Rendered between the header and the cards (offline notice, conflicts, entry form). */
  between?: ReactNode;
  onEdit: (entry: TimeEntry) => void;
}

function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

const minuteOfDay = (ms: number) => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); };

function MoneyList({ money }: { money: ReturnType<typeof moneyList> }) {
  return <span className="num">{money.map(([c, a]) => formatMoney(a, c)).join(" and ")}</span>;
}

export function WeekView({ time, projects, clients, invoices, timer, actions, between, onEdit }: Props) {
  const router = useRouter();
  const nowMs = useNow();
  const today = todayISO();
  const current = weekStartOf(today);
  const [weekStart, setWeekStart] = useState(current);
  const isCurrent = weekStart === current;

  const { days, classified } = useMemo(
    () => buildWeek(weekStart, time, { projects, clients, invoices, timer, nowMs, today }),
    [weekStart, time, projects, clients, invoices, timer, nowMs, today],
  );
  const runningBlock = days.flatMap((d) => d.blocks).find((b) => b.state === "live");
  const runningMinutes = runningBlock?.minutes ?? 0;
  const summary = useMemo(() => summarizeWeek(classified, runningMinutes), [classified, runningMinutes]);
  const rows = useMemo(
    () => projectBreakdown(classified, runningBlock ? { projectId: timer.projectId, minutes: runningMinutes } : undefined),
    [classified, runningBlock, runningMinutes, timer.projectId],
  );
  const allClassified = useMemo(() => classifyAll(time, projects, invoices, today), [time, projects, invoices, today]);
  const unbilled = useMemo(() => unbilledByProject(allClassified), [allClassified]);
  const byDate = useMemo(() => minutesByDate(time), [time]);
  const heat = useMemo(() => heatWeeks(current), [current]);
  const weekTotal = days.reduce((s, d) => s + d.minutes, 0);

  const open = (b: BlockItem) => {
    if (b.invoice) router.push(`/invoices/${b.invoice.id}`);
    else if (b.entry) onEdit(b.entry);
  };

  const wd = weekDays(weekStart);
  const range = `${format(parse(weekStart), "d MMM")} – ${format(parse(wd[6] ?? weekStart), "d MMM")}`;
  const unbilledMoney = moneyList(summary.unbilledMoney);

  const claim = weekTotal === 0 ? "Nothing logged this week." : (
    <>
      You logged <b className="font-semibold text-foreground">{formatHours(summary.billable)}</b> billable: {formatHours(summary.fee)} inside fixed fees and {formatHours(summary.hourly)} on hourly projects.{" "}
      {summary.unbilled > 0
        ? <span className="font-medium text-error-ink">{formatHours(summary.unbilled)} of the hourly work{unbilledMoney.length > 0 && <> — <MoneyList money={unbilledMoney} /></>} hasn’t been billed.</span>
        : summary.hourly > 0 ? "Every hourly hour has been billed." : null}
    </>
  );

  const unbilledTotal = unbilled.reduce((s, u) => s + u.minutes, 0);
  const unbilledAll: Partial<Record<string, number>> = {};
  for (const u of unbilled) unbilledAll[u.currency] = (unbilledAll[u.currency] ?? 0) + u.amount;
  const unbilledAllList = moneyList(unbilledAll);

  return (
    <>
      <PageHeader title="Time" meta={<p className="max-w-[60ch] text-base text-muted-foreground" aria-live="polite">{claim}</p>} actions={actions} />
      <nav aria-label="Week" className="-mt-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => shiftWeek(w, -1))}><ArrowLeft aria-hidden="true" />Previous week</Button>
        <span className="num inline-flex min-h-9 items-center rounded-full border border-primary bg-primary-tint px-3.5 text-sm font-medium text-primary-ink" aria-live="polite">{range}</span>
        <Button variant="outline" size="sm" disabled={isCurrent} onClick={() => setWeekStart((w) => (w >= current ? w : shiftWeek(w, 1)))}>Next week<ArrowRight aria-hidden="true" /></Button>
        {!isCurrent && <Button variant="outline" size="sm" onClick={() => setWeekStart(current)}>This week</Button>}
      </nav>
      {between}

      <Card>
        <CardHead
          title="Your week, shaded by how far the money has got"
          sub="Colour is the client. Fill is the money on hourly projects: solid is paid, tinted is invoiced, dashed is not billed. Hatched hours sit inside a fixed fee, already priced."
          action={<WeekLegend />}
        />
        <WeekGrid days={days} today={today} nowMin={minuteOfDay(nowMs)} onOpen={open} />
        <WeekAgenda days={days} today={today} onOpen={open} />
        <CardFoot className="items-center justify-between gap-y-3 bg-background py-3.5 text-foreground">
          {unbilledTotal > 0 ? (
            <>
              <p className="max-w-[60ch]">
                <b className="font-semibold">{formatHours(unbilledTotal)} of hourly work is still unbilled</b> across {unbilled.length} {unbilled.length === 1 ? "project" : "projects"}
                {unbilledAllList.length > 0 && <> — <MoneyList money={unbilledAllList} /> you’ve earned and not asked for</>}.
              </p>
              <DraftInvoice rows={unbilled} />
            </>
          ) : <p>Nothing unbilled. Every hourly hour has been invoiced.</p>}
        </CardFoot>
      </Card>

      <div className="grid items-start gap-6 @4xl:grid-cols-2">
        <ByProjectCard rows={rows} projects={projects} clients={clients} />
        <HeatCard weeks={heat} byDate={byDate} selected={weekStart} current={current} onSelect={setWeekStart} />
      </div>
    </>
  );
}

/** One project → a link. Several → a small menu (biggest first). One project at a time: invoices/new takes a single projectId. */
function DraftInvoice({ rows }: { rows: UnbilledProject[] }) {
  const router = useRouter();
  const label = "Draft an invoice from these hours";
  const first = rows[0];
  if (!first) return null;
  if (rows.length === 1) return <Button asChild><Link href={`/invoices/new?projectId=${first.projectId}`}>{label}</Link></Button>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button>{label}<ChevronDown aria-hidden="true" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {rows.map((r) => (
          <DropdownMenuItem key={r.projectId} onSelect={() => router.push(`/invoices/new?projectId=${r.projectId}`)} className="flex-col items-start justify-center gap-0 py-2">
            <span className="font-medium">{r.name}</span>
            <span className="num text-xs text-muted-foreground">{formatHours(r.minutes)} · {formatMoney(r.amount, r.currency)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
