"use client";

import { format, parse } from "@/lib/dates";
import { formatDuration } from "@/lib/money";
import { isWeekend } from "./week-logic";
import type { BlockItem, DayModel } from "./week-model";
import { WeekBlock } from "./week-parts";

/** Narrow-container fallback: a stacked per-day agenda with the same state styling. */
export function WeekAgenda({ days, today, onOpen }: { days: DayModel[]; today: string; onOpen: (b: BlockItem) => void }) {
  const shown = days.filter((d) => d.blocks.length > 0 || !isWeekend(d.date));
  return (
    <div className="flex flex-col gap-4 px-5 py-4 @3xl:hidden">
      {shown.map((d) => (
        <section key={d.date} aria-label={format(parse(d.date), "EEEE d MMMM")} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 border-b border-border pb-1.5">
            <h3 className="t-h3" aria-current={d.date === today ? "date" : undefined}>{d.date === today ? "Today · " : ""}{format(parse(d.date), "EEE d MMM")}</h3>
            <span className="num text-sm text-muted-foreground">{d.minutes ? formatDuration(d.minutes) : "—"}</span>
          </div>
          {d.blocks.length === 0 ? <p className="text-sm text-muted-foreground">Nothing logged.</p> : (
            <ul className="flex flex-col gap-1.5">
              {d.blocks.map((b) => <li key={b.id}><WeekBlock block={b} variant="card" onOpen={onOpen} /></li>)}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
