"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2, Undo2, X } from "lucide-react";
import { StateBlock } from "@/components/domain/state-block";
import { Money } from "@/components/domain/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Card, CardHead } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/dates";
import { useChangeRequests, useDeleteChangeRequest } from "@/lib/hooks/change-requests";
import { useApiToast } from "@/lib/hooks/use-api-toast";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";
import { useAppStore } from "@/lib/store";
import type { ChangeRequest, Project } from "@/lib/types";
import { ChangeRequestDecisionDialog, type Decision } from "./change-request-decision-dialog";
import { ChangeRequestDialog } from "./change-request-dialog";
import { changeRequestActions, changeRequestState } from "./logic";
import { StatePill } from "./project-schedule";

function subline(c: ChangeRequest): string {
  if (c.decidedAt) return `${changeRequestState(c.status).label} ${fmtDate(c.decidedAt.slice(0, 10))}`;
  return `Requested ${fmtDate(c.requestedAt.slice(0, 10))}`;
}

/** "Scope changes" on project detail: log extra work, edit it while pending, then approve, reject or withdraw it. */
export function ChangeRequestsPanel({ project }: { project: Project }) {
  const toast = useApiToast();
  const online = useAppStore((s) => s.online);
  const query = useChangeRequests({ projectId: project.id, limit: 100 }, project.currency);
  const remove = useDeleteChangeRequest();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ChangeRequest | null>(null);
  const [deciding, setDeciding] = useState<{ cr: ChangeRequest; decision: Decision } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ChangeRequest | null>(null);

  const rows = query.data?.changeRequests ?? [];
  const offline = !online;
  const busy = remove.isPending;

  const doDelete = (c: ChangeRequest) =>
    remove.mutate(c.id, {
      onSuccess: () => { toast.success(`“${c.title}” deleted`); setConfirmDelete(null); },
      onError: (e) => { toast.error(e, "Couldn’t delete this scope change."); setConfirmDelete(null); },
    });

  const addBtn = <Button variant="outline" size="sm" disabled={offline} onClick={() => setAdding(true)}><Plus aria-hidden="true" />Log scope change</Button>;
  const rateLimited = getApiErrorStatus(query.error) === 429;

  return (
    <Card>
      <CardHead title="Scope changes" sub="Extra work beyond the agreed scope. Log it, then record the client’s decision." action={addBtn} />
      <div aria-busy={query.isFetching}>
        {query.isPending && query.fetchStatus !== "idle" && (
          <div role="status" aria-label="Loading scope changes" className="flex flex-col gap-3 px-5 py-4"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
        )}
        {query.isError && (
          <div className="px-5 py-4">
            <StateBlock
              kind={offline ? "offline" : "error"}
              {...(rateLimited ? { title: "Too many requests", body: "Wait a moment and try again." } : { body: getApiErrorMessage(query.error) })}
              cta={{ label: query.isFetching ? "Retrying…" : "Try again", onClick: () => void query.refetch() }}
            />
          </div>
        )}
        {query.isSuccess && rows.length === 0 && (
          <p className="px-5 py-4 text-sm text-muted-foreground">No scope changes yet. Log the first one when the client asks for something extra.</p>
        )}
        {rows.map((c) => {
          const st = changeRequestState(c.status);
          const actions = changeRequestActions(c);
          return (
            <div key={c.id} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-border px-5 py-4 last:border-b-0">
              <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <span className="font-semibold leading-snug">{c.title}</span>
                  <StatePill {...st} />
                </div>
                <p className="m-0 text-xs leading-snug text-muted-foreground">
                  {subline(c)}{c.estimatedHours !== undefined && <> · <span className="num">{c.estimatedHours}</span> h estimated</>}
                </p>
                {c.description && <p className="m-0 text-sm text-muted-foreground [text-wrap:pretty]">{c.description}</p>}
                {c.decisionNote && <p className="m-0 text-sm [text-wrap:pretty]">Note: {c.decisionNote}</p>}
                {actions.canDecide && (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" className="min-h-11" disabled={offline || busy} onClick={() => setDeciding({ cr: c, decision: "approved" })}><Check aria-hidden="true" />Approve</Button>
                    <Button variant="ghost" size="sm" className="min-h-11" disabled={offline || busy} onClick={() => setDeciding({ cr: c, decision: "rejected" })}><X aria-hidden="true" />Reject</Button>
                    <Button variant="ghost" size="sm" className="min-h-11" disabled={offline || busy} onClick={() => setDeciding({ cr: c, decision: "withdrawn" })}><Undo2 aria-hidden="true" />Withdraw</Button>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 text-end">
                {c.estimatedAmount !== undefined ? <Money amount={c.estimatedAmount} currency={project.currency} size="sm" align="end" /> : <span className="text-sm text-muted-foreground">Unpriced</span>}
                <div className="flex items-center gap-1">
                  {actions.canEdit && <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.title}`} disabled={offline || busy} onClick={() => setEditing(c)}><Pencil aria-hidden="true" /></Button>}
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete ${c.title}`} disabled={offline || busy} onClick={() => setConfirmDelete(c)}><Trash2 aria-hidden="true" /></Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ChangeRequestDialog project={project} open={adding} onOpenChange={setAdding} />
      <ChangeRequestDialog project={project} changeRequest={editing ?? undefined} open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }} />
      <ChangeRequestDecisionDialog changeRequest={deciding?.cr ?? null} decision={deciding?.decision ?? "approved"} onOpenChange={(o) => { if (!o) setDeciding(null); }} />

      <Dialog open={confirmDelete !== null} onOpenChange={(o) => { if (!o && !remove.isPending) setConfirmDelete(null); }}>
        <DialogContent>
          <DialogTitle>Delete “{confirmDelete?.title}”?</DialogTitle>
          <DialogDescription>This removes the scope change and its decision record from the project.</DialogDescription>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <DialogClose asChild><Button variant="outline" disabled={remove.isPending}>Keep it</Button></DialogClose>
            <Button variant="destructive" loading={remove.isPending} onClick={() => confirmDelete && doDelete(confirmDelete)}>Delete scope change</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
