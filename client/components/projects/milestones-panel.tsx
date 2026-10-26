"use client";

import { useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { StateBlock } from "@/components/domain/state-block";
import { Money } from "@/components/domain/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tag } from "@/components/ui/tag";
import { Card, CardHead } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/dates";
import { milestoneStatusToApi, moveItem } from "@/lib/api/mappers/milestones";
import { useDeleteMilestone, useReorderMilestones, useSubmitMilestone, useUpdateMilestone } from "@/lib/hooks/milestones";
import { useApiToast } from "@/lib/hooks/use-api-toast";
import { getApiErrorMessage } from "@/lib/services/api.service";
import { useAppStore } from "@/lib/store";
import type { Milestone, MilestoneStatus, Project } from "@/lib/types";
import { milestoneActions, milestoneState } from "./logic";
import { MilestoneDialog } from "./milestone-dialog";
import { StatePill } from "./project-schedule";
import { relativeDays } from "./rate";

interface Props {
  project: Project;
  query: UseQueryResult<Milestone[]>;
  today: string;
}

function subline(m: Milestone, today: string): string {
  if (m.status === "approved" && m.approvedAt) return `Approved ${fmtDate(m.approvedAt.slice(0, 10))}`;
  if (m.status === "submitted" && m.submittedAt) return `Sent for approval ${fmtDate(m.submittedAt.slice(0, 10))}`;
  if (m.dueDate) return `Due ${fmtDate(m.dueDate)} · ${relativeDays(m.dueDate, today)}`;
  return "No due date";
}

/** Milestones of a project that has them enabled: add, edit, delete, reorder, move through statuses and submit for approval. */
export function MilestonesPanel({ project, query, today }: Props) {
  const toast = useApiToast();
  const online = useAppStore((s) => s.online);
  const update = useUpdateMilestone(project.id);
  const remove = useDeleteMilestone(project.id);
  const submit = useSubmitMilestone(project.id);
  const reorder = useReorderMilestones(project.id);
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState<Milestone | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Milestone | null>(null);

  const milestones = query.data ?? [];
  const busy = update.isPending || remove.isPending || submit.isPending || reorder.isPending;
  const offline = !online;

  const move = (index: number, delta: -1 | 1) => {
    const ids = moveItem(milestones.map((m) => m.id), index, index + delta);
    reorder.mutate(ids, { onError: (e) => toast.error(e, "Couldn’t reorder the milestones.") });
  };
  const changeStatus = (m: Milestone, to: MilestoneStatus) =>
    update.mutate({ id: m.id, body: { status: milestoneStatusToApi(to) } }, { onError: (e) => toast.error(e, "Couldn’t change this milestone’s status.") });
  const doSubmit = (m: Milestone) =>
    submit.mutate(m.id, {
      onSuccess: () => { toast.success(`“${m.title}” sent to ${project.client.name} for approval`); setConfirmSubmit(null); },
      onError: (e) => { toast.error(e, "Couldn’t submit this milestone."); setConfirmSubmit(null); },
    });
  const doDelete = (m: Milestone) =>
    remove.mutate(m.id, {
      onSuccess: () => { toast.success(`“${m.title}” deleted`); setConfirmDelete(null); },
      onError: (e) => { toast.error(e, "Couldn’t delete this milestone."); setConfirmDelete(null); },
    });

  const addBtn = <Button variant="outline" size="sm" disabled={offline} onClick={() => setAdding(true)}><Plus aria-hidden="true" />Add milestone</Button>;

  return (
    <Card>
      <CardHead title="Milestones" sub="Each milestone can carry its own amount. Submit one to ask the client to approve it." action={addBtn} />
      <div aria-busy={query.isFetching}>
        {query.isPending && query.fetchStatus !== "idle" && (
          <div role="status" aria-label="Loading milestones" className="flex flex-col gap-3 px-5 py-4"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
        )}
        {query.isError && (
          <div className="px-5 py-4">
            <StateBlock kind={offline ? "offline" : "error"} body={getApiErrorMessage(query.error)} cta={{ label: query.isFetching ? "Retrying…" : "Try again", onClick: () => void query.refetch() }} />
          </div>
        )}
        {query.isSuccess && milestones.length === 0 && (
          <p className="px-5 py-4 text-sm text-muted-foreground">No milestones yet. Add the first one to start breaking this project into stages.</p>
        )}
        {milestones.map((m, i) => {
          const st = milestoneState(m.status);
          const actions = milestoneActions(m);
          return (
            <div key={m.id} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-border px-5 py-4 last:border-b-0">
              <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <span className="font-semibold leading-snug">{m.title}</span>
                  <StatePill {...st} />
                  {m.approvalRequired && <Tag>Client approval required</Tag>}
                </div>
                <p className="m-0 text-xs leading-snug text-muted-foreground">{subline(m, today)}</p>
                {m.description && <p className="m-0 text-sm text-muted-foreground [text-wrap:pretty]">{m.description}</p>}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {actions.canSubmit && (
                    <Button variant="outline" size="sm" className="min-h-11" disabled={offline || busy} onClick={() => setConfirmSubmit(m)}><Send aria-hidden="true" />Submit for approval</Button>
                  )}
                  {actions.moves.map((mv) => (
                    <Button key={mv.to} variant="ghost" size="sm" className="min-h-11" disabled={offline || busy} onClick={() => changeStatus(m, mv.to)}>{mv.label}</Button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 text-end">
                {m.amount !== undefined ? <Money amount={m.amount} currency={project.currency} size="sm" align="end" /> : <span className="text-sm text-muted-foreground">No amount</span>}
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label={`Move ${m.title} up`} disabled={offline || busy || i === 0} onClick={() => move(i, -1)}><ArrowUp aria-hidden="true" /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Move ${m.title} down`} disabled={offline || busy || i === milestones.length - 1} onClick={() => move(i, 1)}><ArrowDown aria-hidden="true" /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${m.title}`} disabled={offline || busy} onClick={() => setEditing(m)}><Pencil aria-hidden="true" /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete ${m.title}`} disabled={offline || busy} onClick={() => setConfirmDelete(m)}><Trash2 aria-hidden="true" /></Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <MilestoneDialog project={project} open={adding} onOpenChange={setAdding} />
      <MilestoneDialog project={project} milestone={editing ?? undefined} open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }} />

      <Dialog open={confirmSubmit !== null} onOpenChange={(o) => { if (!o && !submit.isPending) setConfirmSubmit(null); }}>
        <DialogContent>
          <DialogTitle>Submit “{confirmSubmit?.title}” for approval?</DialogTitle>
          <DialogDescription>{project.client.name} gets an email with a link to approve it or ask for changes. It doesn’t send any invoice or ask for any money.</DialogDescription>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <DialogClose asChild><Button variant="outline" disabled={submit.isPending}>Not yet</Button></DialogClose>
            <Button loading={submit.isPending} onClick={() => confirmSubmit && doSubmit(confirmSubmit)}>Submit for approval</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete !== null} onOpenChange={(o) => { if (!o && !remove.isPending) setConfirmDelete(null); }}>
        <DialogContent>
          <DialogTitle>Delete “{confirmDelete?.title}”?</DialogTitle>
          <DialogDescription>Time already tracked against it is kept. A milestone that has been invoiced can’t be deleted.</DialogDescription>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <DialogClose asChild><Button variant="outline" disabled={remove.isPending}>Keep milestone</Button></DialogClose>
            <Button variant="destructive" loading={remove.isPending} onClick={() => confirmDelete && doDelete(confirmDelete)}>Delete milestone</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
