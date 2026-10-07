"use client";

import { Notice } from "@/components/ui/notice";
import { Checkbox, ChoiceRow } from "@/components/ui/checkbox";
import { formatAmount } from "@/lib/money";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ManualLines } from "./manual-lines";
import type { ManualRow, ReadyItem } from "./logic";

const TITLES: Record<Project["billingType"], string> = {
  hourly: "Which time should go on it?", retainer: "Which retainer period?", milestone: "Which milestones?", fixed: "What are you billing?",
};

const EMPTY: Record<Project["billingType"], { title: string; body: string }> = {
  hourly: { title: "No uninvoiced billable time.", body: "Log time on this project first, or add a manual line below." },
  retainer: { title: "No unbilled retainer period.", body: "Every period so far is already on an invoice. You can add a manual line below." },
  milestone: { title: "Nothing approved yet.", body: "Only milestones your client has approved can be invoiced. You can add a manual line below, or send a reminder from the project." },
  fixed: { title: "Fully invoiced.", body: "The fixed price has already been invoiced. You can add a manual line below." },
};

interface Props {
  project: Project;
  items: ReadyItem[];
  selected: string[];
  manual: ManualRow[];
  error: string | null;
  onToggle: (id: string) => void;
  onManual: (rows: ManualRow[]) => void;
}

export function StepItems({ project, items, selected, manual, error, onToggle, onManual }: Props) {
  const none = items.every((i) => i.disabled);
  return (
    <section aria-labelledby="ic-2" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
        <h2 id="ic-2" className="t-h2">{TITLES[project.billingType]}</h2>
        <span className="text-sm text-muted-foreground">{project.name}</span>
      </div>
      {none && <Notice tone="warn" role="status"><b>{EMPTY[project.billingType].title}</b> {EMPTY[project.billingType].body}</Notice>}
      <div role="group" aria-label="Items to invoice">
        {items.map((i) => {
          const on = !i.disabled && selected.includes(i.id);
          return (
            <ChoiceRow key={i.id}>
              <Checkbox checked={on} disabled={i.disabled} onCheckedChange={() => onToggle(i.id)} className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className={cn("font-medium", on && "font-bold")}>{i.title}</span><br />
                <span className="t-caption">{i.sub}</span>
              </span>
              <span className="num ms-auto whitespace-nowrap">{formatAmount(i.amount, project.currency)}</span>
            </ChoiceRow>
          );
        })}
      </div>
      <ManualLines rows={manual} currency={project.currency} showErrors={error !== null} onChange={onManual} />
    </section>
  );
}
