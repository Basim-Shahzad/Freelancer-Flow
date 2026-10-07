import { Check } from "lucide-react";
import { Logo } from "@/components/brand";
import { cn } from "@/lib/utils";
import { STEP_COUNT, STEP_TITLES } from "../onboarding-logic";

/** Wide: vertical thread of nodes. Narrow: "Step n of 5" with a five-segment bar. */
export function StepRail({ step }: { step: number }) {
  return (
    <aside aria-label="Setup progress" className="flex flex-col gap-3 border-b border-border px-5 py-4 @3xl:gap-9 @3xl:border-b-0 @3xl:border-e @3xl:px-7 @3xl:py-10">
      <Logo />
      <div className="hidden flex-col gap-2.5 @3xl:flex">
        <span className="t-eyebrow">Set up your studio</span>
        <ol className="relative m-0 list-none p-0">
          {STEP_TITLES.map((label, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={label} aria-current={current ? "step" : undefined} className="relative flex min-h-12 items-center gap-3 text-sm">
                {i < STEP_COUNT - 1 && <span aria-hidden="true" className={cn("absolute inset-y-6 start-[10px] -ms-px w-px bg-rule", done && "bg-foreground")} />}
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative z-[1] grid size-[22px] shrink-0 place-items-center rounded-full border border-rule bg-background text-background",
                    done && "border-foreground bg-foreground",
                    current && "border-2 border-primary shadow-[0_0_0_4px_var(--primary-tint)] after:size-2 after:rounded-full after:bg-primary after:content-['']",
                  )}
                >
                  {done && <Check className="size-3" strokeWidth={2.5} />}
                </span>
                <span className={cn("text-muted-foreground", (done || current) && "text-foreground", current && "font-bold")}>
                  {label}
                  {done && <span className="sr-only"> (done)</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="t-caption mt-auto hidden max-w-[28ch] @3xl:block">About three minutes. Everything here can be changed later in Settings.</p>
      <div className="flex flex-col gap-2.5 @3xl:hidden">
        <span className="t-caption">Step {step + 1} of {STEP_COUNT} · <b className="font-semibold text-foreground">{STEP_TITLES[step]}</b></span>
        <div aria-hidden="true" className="grid grid-cols-5 gap-1">
          {STEP_TITLES.map((t, i) => <span key={t} className={cn("h-0.5 bg-border", i <= step && "bg-foreground")} />)}
        </div>
      </div>
    </aside>
  );
}
