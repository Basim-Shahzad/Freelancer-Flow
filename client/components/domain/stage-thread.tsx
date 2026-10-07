"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const STAGES = ["Work", "Approval", "Invoice", "Instructions", "Paid"] as const;
export type Stage = "work" | "approval" | "invoice" | "instructions" | "paid";
const KEYS: Stage[] = ["work", "approval", "invoice", "instructions", "paid"];
const FILL = ["w-0", "w-[20%]", "w-[40%]", "w-[60%]", "w-[80%]"];

/**
 * The signature thread: Work → Approval → Invoice → Instructions → Paid.
 * Gold (accent) appears ONLY on the Paid node. Labels collapse into a "Now:" line in
 * narrow containers. The Paid animation honours prefers-reduced-motion (globals.css).
 */
export function StageThread({ stage, caption, className, animate = true }: { stage: Stage; caption?: string; className?: string; animate?: boolean }) {
  const idx = KEYS.indexOf(stage);
  const paid = idx === 4;
  // Re-trigger the Paid animation when the stage changes to paid.
  const [run, setRun] = useState(false);
  const prev = useRef<Stage | null>(null);
  useEffect(() => {
    if (paid && animate && prev.current !== "paid") { setRun(false); const t = setTimeout(() => setRun(true), 40); prev.current = stage; return () => clearTimeout(t); }
    prev.current = stage;
  }, [stage, paid, animate]);

  return (
    <div className={cn("@container flex flex-col gap-3", className)}>
      <ol aria-label="Progress: Work, Approval, Invoice, Instructions, Paid" className="relative m-0 grid list-none grid-cols-5 p-0 py-0.5">
        <li aria-hidden="true" className="absolute inset-x-[10%] top-[11px] h-px bg-rule" />
        <li aria-hidden="true" className={cn("absolute start-[10%] top-[11px] h-px bg-foreground transition-[width] duration-700 ease-out-soft", FILL[idx], run && "origin-left animate-[fill-in_0.9s_var(--ease-out-soft)_1_both]")} />
        {STAGES.map((label, i) => {
          const done = i < idx;
          const current = i === idx;
          const isPaid = current && paid;
          return (
            <li key={label} aria-current={current ? "step" : undefined} className="relative flex flex-col items-center gap-2 text-center">
              <span
                className={cn(
                  "relative z-[1] grid size-[22px] place-items-center rounded-full border border-rule bg-background text-background",
                  done && "border-foreground bg-foreground",
                  current && !isPaid && "border-2 border-primary shadow-[0_0_0_4px_var(--primary-tint)] after:size-2 after:rounded-full after:bg-primary after:content-['']",
                  isPaid && "border-accent bg-accent text-foreground",
                  isPaid && run && "animate-[paid-pop_0.5s_var(--ease-out-soft)_0.4s_1_both] before:absolute before:-inset-px before:rounded-full before:border before:border-accent before:animate-[paid-ring_1.3s_var(--ease-out-soft)_0.35s_1_both] before:content-['']",
                )}
              >
                {(done || isPaid) && <Check className="size-3" strokeWidth={2.5} aria-hidden="true" />}
              </span>
              <span className={cn("hidden text-xs leading-tight text-muted-foreground @md:block", (done || current) && "text-foreground", current && "font-bold")}>{label}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-1 text-sm @md:hidden">Now: <b className="font-bold">{STAGES[idx]}</b></div>
      {caption && <div className="t-caption">{caption}</div>}
    </div>
  );
}
