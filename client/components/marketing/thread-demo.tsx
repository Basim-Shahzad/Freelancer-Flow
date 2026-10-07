"use client";

import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useState } from "react";
import { StageThread, type Stage } from "@/components/domain/stage-thread";
import { Button } from "@/components/ui/button";

const STAGES: { stage: Stage; caption: string }[] = [
  { stage: "work", caption: "Work: time and milestones are being tracked." },
  { stage: "approval", caption: "Approval: your client reviews progress from one private link." },
  { stage: "invoice", caption: "Invoice: ready work is on a clear invoice, with a matching PDF." },
  { stage: "instructions", caption: "Instructions shared: waiting for your client to pay you directly." },
  { stage: "paid", caption: "Paid: you recorded the payment. The thread closes." },
];

/** Interactive StageThread: the visitor steps through the five stages. */
export function ThreadDemo() {
  const [i, setI] = useState(0);
  const cur = STAGES[i] ?? STAGES[0]!;
  const last = i === STAGES.length - 1;
  return (
    <div className="flex flex-col gap-4">
      <StageThread stage={cur.stage} />
      <p role="status" aria-live="polite" className="min-h-10 text-sm text-foreground">{cur.caption}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={i === 0} onClick={() => setI((n) => Math.max(0, n - 1))}>
          <ChevronLeft aria-hidden="true" className="rtl:rotate-180" />Previous
        </Button>
        {last ? (
          <Button onClick={() => setI(0)}><RotateCcw aria-hidden="true" />Start over</Button>
        ) : (
          <Button onClick={() => setI((n) => Math.min(STAGES.length - 1, n + 1))}>
            Advance the stage<ChevronRight aria-hidden="true" className="rtl:rotate-180" />
          </Button>
        )}
      </div>
    </div>
  );
}
