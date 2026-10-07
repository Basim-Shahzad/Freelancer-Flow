"use client";

import { Notice } from "@/components/ui/notice";
import { RadioGroup, RadioItem } from "@/components/ui/radio-group";
import { ChoiceRow } from "@/components/ui/checkbox";
import { Tag } from "@/components/ui/tag";
import type { Client, Project } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<Project["billingType"], string> = { hourly: "Hourly", retainer: "Retainer", milestone: "Milestone", fixed: "Fixed" };

export interface ProjectChoice { project: Project; client?: Client; note: string }

export function StepProject({ choices, value, onChange }: { choices: ProjectChoice[]; value: string; onChange: (id: string) => void }) {
  return (
    <section aria-labelledby="ic-1" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2"><h2 id="ic-1" className="t-h2">Which project?</h2></div>
      {choices.length === 0 && <Notice tone="warn"><b>No projects yet.</b> Create a project first, then invoice it from here.</Notice>}
      <RadioGroup value={value} onValueChange={onChange} aria-label="Project">
        {choices.map(({ project: p, client, note }) => (
          <ChoiceRow key={p.id}>
            <RadioItem value={p.id} />
            <span className="min-w-0 flex-1">
              <span className={cn("font-medium", value === p.id && "font-bold")}>{p.name}</span><br />
              <span className="t-caption">{client?.name ?? "Unknown client"} · {note}</span>
            </span>
            <Tag className="ms-auto">{TYPE_LABEL[p.billingType]}</Tag>
          </ChoiceRow>
        ))}
      </RadioGroup>
    </section>
  );
}
