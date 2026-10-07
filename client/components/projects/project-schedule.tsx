"use client";

import Link from "next/link";
import { Check, CheckCircle2, CircleDashed, Clock, Copy, TriangleAlert, type LucideIcon } from "lucide-react";
import { Money } from "@/components/domain/money";
import { statusLabel } from "@/components/domain/status-chip";
import { Button } from "@/components/ui/button";
import { Card, CardHead } from "@/components/ui/section";
import { fmtDate } from "@/lib/dates";
import { formatHours } from "@/lib/money";
import type { InvoiceView } from "@/lib/selectors";
import type { Project, TimeEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { milestoneState, unbilledWeeks } from "./logic";
import { relativeDays } from "./rate";

type Tone = "done" | "wait" | "todo" | "warn";
const TONE: Record<Tone, { Icon: LucideIcon; cls: string }> = {
  done: { Icon: CheckCircle2, cls: "border-[color-mix(in_srgb,var(--success)_50%,var(--border))] bg-success-tint text-success-ink" },
  wait: { Icon: Clock, cls: "border-[color-mix(in_srgb,var(--primary)_50%,var(--border))] bg-primary-tint text-primary-ink" },
  todo: { Icon: CircleDashed, cls: "border-dashed border-rule text-muted-foreground" },
  warn: { Icon: TriangleAlert, cls: "border-[color-mix(in_srgb,var(--warning)_50%,var(--border))] bg-warning-tint text-warning-ink" },
};
const linkCls = "inline-flex min-h-11 items-center text-sm font-medium text-primary-ink underline decoration-1 underline-offset-[3px]";

interface RowProps {
  title: string; sub?: string; amount: number; project: Project;
  state: { label: string; tone: Tone }; invoice?: InvoiceView; action?: React.ReactNode;
}

function Row({ title, sub, amount, project, state, invoice, action }: RowProps) {
  const { Icon, cls } = TONE[state.tone];
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-border px-5 py-4 last:border-b-0">
      <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span className="font-semibold leading-snug">{title}</span>
          <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border py-[0.1875rem] pe-2.5 ps-2 text-xs font-semibold leading-[1.3]", cls)}>
            <Icon className="size-[1.1em]" strokeWidth={1.5} aria-hidden="true" />{state.label}
          </span>
        </div>
        {sub && <p className="m-0 text-xs leading-snug text-muted-foreground">{sub}</p>}
      </div>
      <div className="flex flex-col items-end gap-2 text-end">
        <Money amount={amount} currency={project.currency} size="sm" align="end" />
        {invoice && (
          <Link href={`/invoices/${invoice.id}`} className="inline-flex min-h-8 items-center rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground no-underline hover:border-primary hover:bg-primary-tint">
            <span className="num">{invoice.number}</span><span aria-hidden="true">&nbsp;·&nbsp;</span>{statusLabel(invoice.display)}
          </Link>
        )}
        {action}
      </div>
    </div>
  );
}

interface Common { project: Project; views: InvoiceView[]; today: string }

function CopyLink({ id, copied, onCopy }: { id: string; copied: string | null; onCopy: () => void }) {
  const done = copied === id;
  return (
    <Button variant="outline" size="sm" onClick={onCopy} className="min-h-11">
      {done ? <Check className="text-success-ink" aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {done ? "Link copied" : "Copy share link"}
      <span aria-live="polite" className="sr-only">{done ? "Share link copied to clipboard" : ""}</span>
    </Button>
  );
}

export function MilestoneSchedule({ project, views, today, copied, onCopy }: Common & { copied: string | null; onCopy: (id: string) => void }) {
  return (
    <Card>
      <CardHead title="Milestones" sub="Each milestone carries its own amount and its own invoice." />
      <div>
        {project.milestones.map((m) => {
          const st = milestoneState(m.status);
          const sub = m.status === "approved" ? `Approved ${fmtDate(m.approvedAt)}` : m.status === "changes_requested" && m.comment ? `Client note: “${m.comment}”` : `Due ${fmtDate(m.dueDate)} · ${relativeDays(m.dueDate, today)}`;
          const invoice = views.find((v) => v.id === m.invoiceId);
          const action = m.status === "awaiting_approval"
            ? <CopyLink id={m.id} copied={copied} onCopy={() => onCopy(m.id)} />
            : m.status === "approved" && !m.invoiceId
              ? <Link href={`/invoices/new?projectId=${project.id}&milestoneId=${m.id}`} className={linkCls}>Create invoice</Link>
              : undefined;
          return <Row key={m.id} title={m.title} sub={sub} amount={m.amount} project={project} state={st} invoice={invoice} action={action} />;
        })}
      </div>
    </Card>
  );
}

export function RetainerSchedule({ project, views, today }: Common) {
  return (
    <Card>
      <CardHead title="Retainer periods" sub="One period per month." />
      <div>
        {project.retainerPeriods.length === 0 && <p className="px-5 py-4 text-sm text-muted-foreground">No periods yet. Periods appear once the retainer starts.</p>}
        {[...project.retainerPeriods].sort((a, b) => (a.start < b.start ? -1 : 1)).map((r) => {
          const invoice = views.find((v) => v.id === r.invoiceId);
          const current = r.start <= today && today <= r.end;
          const ready = !r.invoiceId && r.start <= today;
          const state = invoice ? { label: "Invoiced", tone: "done" as const } : ready ? { label: "Ready to invoice", tone: "wait" as const } : { label: "Upcoming", tone: "todo" as const };
          return (
            <Row key={r.id} title={r.label} sub={`${fmtDate(r.start)} – ${fmtDate(r.end)}${current ? " · in progress" : ""}`} amount={r.amount} project={project} state={state} invoice={invoice}
              action={ready ? <Link href={`/invoices/new?projectId=${project.id}&period=${r.id}`} className={linkCls}>Create invoice</Link> : undefined} />
          );
        })}
      </div>
    </Card>
  );
}

export function HourlySchedule({ project, time }: { project: Project; time: TimeEntry[] }) {
  const weeks = unbilledWeeks(project, time);
  return (
    <Card>
      <CardHead title="Unbilled time" sub="Billable time not yet on an invoice, by week." action={<Link href="/time" className={linkCls}>Open in Time</Link>} />
      <div>
        {weeks.length === 0 && <p className="px-5 py-4 text-sm text-muted-foreground">Everything tracked is on an invoice. Billable time you log will wait here.</p>}
        {weeks.map((w) => (
          <Row key={w.key} title={w.label} sub={`${w.entries} ${w.entries === 1 ? "entry" : "entries"}${w.titles ? ` · ${w.titles}` : ""}`} amount={w.amount} project={project}
            state={{ label: `Unbilled · ${formatHours(w.minutes)}`, tone: "wait" }}
            action={<Link href={`/invoices/new?projectId=${project.id}`} className={linkCls}>Add to invoice</Link>} />
        ))}
      </div>
    </Card>
  );
}

export function FixedSchedule({ project, views, invoiced }: Common & { invoiced: number }) {
  const price = project.fixedAmount ?? 0;
  const remaining = Math.max(price - invoiced, 0);
  const list = views.filter((v) => v.display !== "void");
  return (
    <Card>
      <CardHead title="Billing schedule" sub="What has been invoiced and what is left of the fee." />
      <div>
        {list.map((v) => (
          <Row key={v.id} title={v.number} sub={`Issued ${fmtDate(v.issueDate)}`} amount={v.totals.total} project={project} state={v.display === "draft" ? { label: "Draft", tone: "todo" } : { label: "Invoiced", tone: "done" }} invoice={v} />
        ))}
        {remaining > 0 && (
          <Row title="Balance to invoice" sub={project.status === "completed" ? "Project completed" : "On delivery"} amount={remaining} project={project} state={{ label: "Not yet invoiced", tone: "todo" }}
            action={<Link href={`/invoices/new?projectId=${project.id}`} className={linkCls}>Create invoice</Link>} />
        )}
      </div>
    </Card>
  );
}
