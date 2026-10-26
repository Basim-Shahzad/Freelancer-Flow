"use client";

import { CheckCircle2, CircleDashed, Clock, TriangleAlert, type LucideIcon } from "lucide-react";
import { Money } from "@/components/domain/money";
import { StateBlock } from "@/components/domain/state-block";
import { Card, CardHead } from "@/components/ui/section";
import { fmtDate } from "@/lib/dates";
import { getApiErrorMessage } from "@/lib/services/api.service";
import type { Project, RetainerPeriod } from "@/lib/types";
import { cn } from "@/lib/utils";
import { INTERVAL_LABEL, type MilestoneTone } from "./logic";

export const TONE: Record<MilestoneTone, { Icon: LucideIcon; cls: string }> = {
  done: { Icon: CheckCircle2, cls: "border-[color-mix(in_srgb,var(--success)_50%,var(--border))] bg-success-tint text-success-ink" },
  wait: { Icon: Clock, cls: "border-[color-mix(in_srgb,var(--primary)_50%,var(--border))] bg-primary-tint text-primary-ink" },
  todo: { Icon: CircleDashed, cls: "border-dashed border-rule text-muted-foreground" },
  warn: { Icon: TriangleAlert, cls: "border-[color-mix(in_srgb,var(--warning)_50%,var(--border))] bg-warning-tint text-warning-ink" },
};

/** Icon + label pill (never colour alone). */
export function StatePill({ label, tone }: { label: string; tone: MilestoneTone }) {
  const { Icon, cls } = TONE[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border py-[0.1875rem] pe-2.5 ps-2 text-xs font-semibold leading-[1.3]", cls)}>
      <Icon className="size-[1.1em]" strokeWidth={1.5} aria-hidden="true" />{label}
    </span>
  );
}

interface PeriodsProps {
  project: Project;
  periods: RetainerPeriod[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  today: string;
}

/**
 * A retainer's billing periods, invoiced vs not yet. The "invoice this period" action arrives with the
 * invoices update; until then an unbilled period is only labelled.
 */
export function RetainerSchedule({ project, periods, isLoading, error, onRetry, today }: PeriodsProps) {
  const per = project.retainerInterval ? INTERVAL_LABEL[project.retainerInterval] : "period";
  return (
    <Card>
      <CardHead title="Retainer periods" sub={`One period per ${per}, billed in advance.`} />
      <div aria-busy={isLoading}>
        {isLoading && <p className="px-5 py-4 text-sm text-muted-foreground" role="status">Loading periods…</p>}
        {!isLoading && error !== null && error !== undefined && (
          <div className="px-5 py-4"><StateBlock kind="error" body={getApiErrorMessage(error)} cta={{ label: "Try again", onClick: onRetry }} /></div>
        )}
        {!isLoading && !error && periods?.length === 0 && <p className="px-5 py-4 text-sm text-muted-foreground">No periods yet. Periods appear once the retainer starts.</p>}
        {[...(periods ?? [])].sort((a, b) => (a.start < b.start ? -1 : 1)).map((r) => {
          const current = r.start <= today && today <= r.end;
          const state = r.invoiceId ? { label: "Invoiced", tone: "done" as const } : { label: "Not yet invoiced", tone: r.start <= today ? ("wait" as const) : ("todo" as const) };
          return (
            <div key={r.id} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-border px-5 py-4 last:border-b-0">
              <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <span className="font-semibold leading-snug">{r.label}</span>
                  <StatePill {...state} />
                </div>
                <p className="m-0 text-xs leading-snug text-muted-foreground">{fmtDate(r.start)} – {fmtDate(r.end)}{current ? " · in progress" : ""}</p>
              </div>
              <Money amount={r.amount} currency={project.currency} size="sm" align="end" />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
