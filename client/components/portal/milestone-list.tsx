"use client";

import { Check, ExternalLink } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/label";
import { LMain, LSub } from "@/components/ui/ledger";
import { Notice } from "@/components/ui/notice";
import { Tag } from "@/components/ui/tag";
import { formatMoney } from "@/lib/money";
import { useAppStore } from "@/lib/store";
import type { Milestone, Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MILESTONE_STATE_LABEL, milestoneSub } from "./portal-logic";

export type Outcome = { kind: "approved" } | { kind: "changes"; comment: string };

function Node({ status }: { status: Milestone["status"] }) {
  const done = status === "approved";
  const wait = status === "awaiting_approval" || status === "changes_requested";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mt-[0.2rem] grid size-[1.125rem] place-items-center rounded-full border-[1.5px] border-rule bg-background text-background",
        done && "border-foreground bg-foreground",
        wait && "border-primary shadow-[0_0_0_3px_var(--primary-tint)]",
      )}
    >
      {done && <Check className="size-3" strokeWidth={2.5} />}
    </span>
  );
}

function ReviewBlock({ project, milestone, ownerFirst, online, onDone }: { project: Project; milestone: Milestone; ownerFirst: string; online: boolean; onDone: (o: Outcome) => void }) {
  const approve = useAppStore((s) => s.approveMilestone);
  const requestChanges = useAppStore((s) => s.requestMilestoneChanges);
  const [comment, setComment] = useState("");
  const [error, setError] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = `pp-c-${milestone.id}`;

  const onApprove = () => { approve(project.id, milestone.id); onDone({ kind: "approved" }); };
  const onReject = () => {
    const text = comment.trim();
    if (!text) { setError(true); ref.current?.focus(); return; }
    requestChanges(project.id, milestone.id, text);
    onDone({ kind: "changes", comment: text });
  };

  return (
    <div className="col-[2/-1] flex flex-col gap-3 pt-3">
      <p className="text-sm">{milestone.description}</p>
      <a href="#design-files" onClick={(e) => e.preventDefault()} className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-primary-ink no-underline hover:underline">
        <ExternalLink className="size-4" aria-hidden="true" />Open the design files
      </a>
      <Field
        label={<>Comment <span className="font-normal text-muted-foreground">(required if you request changes)</span></>}
        htmlFor={id}
        error={error ? `Tell ${ownerFirst} what to change so they can fix it.` : undefined}
      >
        <Textarea
          ref={ref}
          id={id}
          rows={3}
          maxLength={1000}
          value={comment}
          placeholder={`Anything ${ownerFirst} should know?`}
          aria-invalid={error || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => { setComment(e.target.value); if (error) setError(false); }}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onApprove} disabled={!online}>Approve milestone</Button>
        <Button variant="outline" onClick={onReject} disabled={!online}>Request changes</Button>
      </div>
      <p className="t-caption">Approving tells {ownerFirst} they can invoice this milestone. It doesn’t send any money.</p>
    </div>
  );
}

function OutcomeNotice({ outcome, ownerFirst }: { outcome: Outcome; ownerFirst: string }) {
  return (
    <div className="col-[2/-1] pt-3">
      {outcome.kind === "approved" ? (
        <Notice tone="ok">Thank you. {ownerFirst} has been told and will send an invoice for this milestone.</Notice>
      ) : (
        <Notice tone="warn">You asked for changes: “{outcome.comment}” {ownerFirst} has been told.</Notice>
      )}
    </div>
  );
}

interface Props {
  project: Project;
  ownerFirst: string;
  online: boolean;
  outcomes: Record<string, Outcome | undefined>;
  onOutcome: (milestoneId: string, o: Outcome) => void;
}

export function MilestoneList({ project, ownerFirst, online, outcomes, onOutcome }: Props) {
  return (
    <ol className="m-0 list-none p-0">
      {project.milestones.map((m) => {
        const outcome = outcomes[m.id];
        return (
          <li key={m.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-3 border-b border-border py-4">
            <Node status={m.status} />
            <div className="min-w-0">
              <LMain>{m.title}</LMain>
              <LSub>{milestoneSub(m, ownerFirst)}</LSub>
              {m.status === "changes_requested" && m.comment && !outcome && <LSub className="pt-1">Your note: “{m.comment}”</LSub>}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="num font-semibold">{formatMoney(m.amount, project.currency)}</span>
              <Tag>{MILESTONE_STATE_LABEL[m.status]}</Tag>
            </div>
            {outcome ? (
              <OutcomeNotice outcome={outcome} ownerFirst={ownerFirst} />
            ) : (
              m.status === "awaiting_approval" && <ReviewBlock project={project} milestone={m} ownerFirst={ownerFirst} online={online} onDone={(o) => onOutcome(m.id, o)} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
