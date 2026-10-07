"use client";

import { Lock } from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shortDuration, STATE_LABEL, type BillState } from "./week-logic";
import type { BlockItem } from "./week-model";

/** Fill language: paid solid, invoiced tinted, not billed dashed, in the fee hatched, running solid success. */
export const STATE_CLASS: Record<BillState, string> = {
  paid: "border-[var(--c)] bg-[var(--c)] text-primary-foreground",
  invoiced: "border-[color-mix(in_srgb,var(--c)_45%,transparent)] bg-[color-mix(in_srgb,var(--c)_26%,var(--surface))] text-foreground",
  unbilled: "border-[1.5px] border-dashed border-[var(--c)] bg-surface text-foreground",
  fee: "border-[color-mix(in_srgb,var(--c)_30%,transparent)] bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--c)_30%,var(--surface))_0_2px,var(--surface)_2px_4px)] text-foreground",
  nonbill: "border-border bg-hover text-muted-foreground",
  live: "border-success bg-success text-primary-foreground",
};

const swatch = "inline-block size-3 shrink-0 rounded-[3px]";
const KEY_CLASS: [BillState, string, string][] = [
  ["paid", "Paid", "border border-primary bg-primary"],
  ["invoiced", "Invoiced", "border border-[color-mix(in_srgb,var(--primary)_45%,transparent)] bg-[color-mix(in_srgb,var(--primary)_26%,var(--surface))]"],
  ["unbilled", "Not billed", "border-[1.5px] border-dashed border-primary"],
  ["fee", "Fixed fee", "border border-[color-mix(in_srgb,var(--primary)_30%,transparent)] bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--primary)_30%,var(--surface))_0_2px,var(--surface)_2px_4px)]"],
  ["live", "Running", "bg-success"],
];

/** Legend for the fill states (icon-free swatches paired with labels, so state is never colour alone). */
export function WeekLegend() {
  return (
    <ul className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted-foreground" aria-label="Fill key">
      {KEY_CLASS.map(([k, label, cls]) => (
        <li key={k} className="inline-flex items-center gap-1.5"><i aria-hidden="true" className={cn(swatch, cls)} />{label}</li>
      ))}
    </ul>
  );
}

interface BlockProps {
  block: BlockItem;
  /** "grid" = absolutely positioned time block; "card" = agenda card. */
  variant: "grid" | "card";
  style?: CSSProperties;
  onOpen: (b: BlockItem) => void;
}

/** One time entry. A button (opens the entry editor, or the invoice when the entry is locked). The running timer is not interactive. */
export function WeekBlock({ block: b, variant, style, onOpen }: BlockProps) {
  const tall = variant === "card" || b.endMin - b.startMin >= 54;
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-1 font-semibold leading-tight">
        {b.state === "live" && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary-foreground motion-safe:animate-pulse" />}
        <span className="truncate">{b.projectName}</span>
        {b.invoice && <Lock className="size-3 shrink-0" aria-hidden="true" />}
      </span>
      {variant === "card" && <span className="block truncate text-xs opacity-90">{b.clientName} · {b.description}</span>}
      {tall && (
        <span className="num block truncate text-xs opacity-90">
          {shortDuration(b.minutes)} · {STATE_LABEL[b.state]}{b.state === "live" && " now"}{b.unsynced && " · unsynced"}
        </span>
      )}
    </>
  );
  const cls = cn(
    "block min-w-0 overflow-hidden rounded-md border px-2 py-1 text-start text-[0.8125rem] leading-snug",
    STATE_CLASS[b.state],
    variant === "grid" && "absolute",
    variant === "card" && "w-full px-3 py-2",
  );
  const st = { ...style, "--c": b.hue } as CSSProperties;
  if (b.state === "live") {
    return <div role="group" aria-label={b.label} className={cls} style={st}>{content}</div>;
  }
  return (
    <Button
      variant="bare"
      aria-label={b.label}
      title={`${b.description} · ${b.label}`}
      onClick={() => onOpen(b)}
      className={cn("min-h-0", cls, "transition-shadow hover:ring-2 hover:ring-[color-mix(in_srgb,var(--c)_40%,transparent)] focus-visible:z-10")}
      style={st}
    >
      {content}
    </Button>
  );
}
