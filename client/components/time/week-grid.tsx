"use client";

import { format, parse } from "@/lib/dates";
import { formatDuration } from "@/lib/money";
import { cn } from "@/lib/utils";
import { axisTicks, blockGeometry, hourRange, isWeekend, nowPercent } from "./week-logic";
import type { BlockItem, DayModel } from "./week-model";
import { WeekBlock } from "./week-parts";

const HOUR_REM = 2.9;

/** Hour axis shared by the week: 08–20 by default, widened to hold every block. */
export const rangeFor = (days: DayModel[], nowMin?: number) => {
  const blocks: { startMin: number; endMin: number }[] = days.flatMap((d) => d.blocks);
  // A running block must never be clipped: keep "now" (plus a little room) inside the axis.
  if (nowMin !== undefined) blocks.push({ startMin: nowMin, endMin: nowMin + 1 });
  return hourRange(blocks);
};

export function DayHead({ day, today }: { day: DayModel; today: string }) {
  const off = isWeekend(day.date) && day.minutes === 0;
  const d = parse(day.date);
  return (
    <div className={cn("px-1 pb-2", off && "text-muted-foreground", day.date === today && "text-primary-ink")}>
      <div className="text-sm font-semibold" aria-current={day.date === today ? "date" : undefined}>{format(d, "EEE d")}</div>
      <div className="num text-xs text-muted-foreground">{day.minutes ? formatDuration(day.minutes) : off ? "weekend" : "—"}</div>
    </div>
  );
}

/** The 7-column time grid. Shown from @3xl; narrower containers use the agenda instead. */
export function WeekGrid({ days, today, nowMin, onOpen }: { days: DayModel[]; today: string; nowMin: number; onOpen: (b: BlockItem) => void }) {
  const range = rangeFor(days, days.some((d) => d.blocks.some((b) => b.id === "__running")) ? nowMin : undefined);
  const ticks = axisTicks(range);
  const height = `${(range.end - range.start) * HOUR_REM}rem`;
  return (
    <div className="hidden px-5 pb-5 pt-4 @3xl:block">
      <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] gap-x-1.5">
        <div />
        {days.map((d) => <DayHead key={d.date} day={d} today={today} />)}
        <div className="relative" style={{ height }} aria-hidden="true">
          {ticks.map((h) => (
            <span key={h} className="num absolute -translate-y-1/2 text-[0.6875rem] text-muted-foreground first:translate-y-0" style={{ top: `${((h - range.start) / (range.end - range.start)) * 100}%` }}>
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
        </div>
        {days.map((d) => {
          const off = isWeekend(d.date) && d.blocks.length === 0;
          const now = d.date === today ? nowPercent(nowMin, range) : null;
          return (
            <div key={d.date} role="group" aria-label={format(parse(d.date), "EEEE d MMMM")} className={cn("relative overflow-hidden rounded-lg border", off ? "border-dashed border-border" : "border-transparent bg-background")} style={{ height }}>
              <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                {ticks.slice(1, -1).map((h) => (
                  <span key={h} className="absolute inset-x-0 border-t border-border" style={{ top: `${((h - range.start) / (range.end - range.start)) * 100}%` }} />
                ))}
              </div>
              {off && <span aria-hidden="true" className="absolute inset-x-0 top-1/2 text-center text-muted-foreground">—</span>}
              {d.blocks.map((b) => {
                const g = blockGeometry(b, range);
                return (
                  <WeekBlock
                    key={b.id}
                    block={b}
                    variant="grid"
                    onOpen={onOpen}
                    style={{ top: `${g.top}%`, height: `${g.height}%`, insetInlineStart: `calc(${(b.lane / b.lanes) * 100}% + 2px)`, width: `calc(${100 / b.lanes}% - 4px)` }}
                  />
                );
              })}
              {now !== null && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-error" style={{ top: `${now}%` }}>
                  <span className="absolute -top-[5px] size-2 rounded-full bg-error" style={{ insetInlineStart: "-2px" }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
