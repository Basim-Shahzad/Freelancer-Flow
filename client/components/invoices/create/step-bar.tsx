"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STEPS } from "./logic";

/** Clickable step bar. Done steps show a check, the current step has aria-current="step". */
export function StepBar({ step, onGo }: { step: number; onGo: (n: number) => void }) {
  return (
    <nav aria-label="Invoice steps" className="border-y border-rule">
      <ol className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 py-1">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const current = n === step;
          return (
            <li key={label}>
              <Button
                variant="bare"
                aria-current={current ? "step" : undefined}
                onClick={() => onGo(n)}
                className={cn("text-muted-foreground", current && "font-bold text-foreground", done && "text-foreground")}
              >
                <b
                  className={cn(
                    "grid size-6 place-items-center rounded-full border border-rule text-xs",
                    current && "border-foreground bg-foreground text-background",
                    done && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : n}
                </b>
                {label}
                {done && <span className="sr-only"> (done)</span>}
              </Button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
