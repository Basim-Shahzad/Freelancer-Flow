"use client";

import { useState } from "react";
import { OfflineNotice } from "@/components/dashboard/offline-notice";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Tag } from "@/components/ui/tag";
import { Textarea } from "@/components/ui/textarea";
import { fmtDate } from "@/lib/dates";
import { classifyPortalError } from "@/lib/api/mappers/portal";
import { useApproveMilestone, usePortalMilestone, useRejectMilestone } from "@/lib/hooks/portal";
import { usePortalToken } from "@/lib/portal/token";
import { useAppStore } from "@/lib/store";
import { isDecidable, MILESTONE_STATE_LABEL } from "./portal-logic";
import { MissingToken, PortalErrorState, PortalSkeleton } from "./portal-states";

type Decision = "approve" | "reject";

export function MilestonePortalView({ id }: { id: string }) {
  const token = usePortalToken();
  const online = useAppStore((s) => s.online);
  const query = usePortalMilestone(id, token);
  const approve = useApproveMilestone(id, token);
  const reject = useRejectMilestone(id, token);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState<Decision | null>(null);

  if (!token) return <MissingToken what="milestone" />;
  if (query.isPending) return <PortalSkeleton />;
  if (query.isError) return <PortalErrorState error={query.error} what="milestone" onRetry={() => void query.refetch()} />;

  const m = query.data;
  const mutation = decision === "reject" ? reject : approve;
  const error = mutation.isError ? classifyPortalError(mutation.error) : null;

  const close = (next: boolean) => {
    if (mutation.isPending) return;
    if (!next) { setDecision(null); approve.reset(); reject.reset(); }
  };
  const confirm = () => {
    if (!decision) return;
    const run = decision === "approve" ? approve : reject;
    run.mutate(comment.trim() || undefined, { onSuccess: () => { setDone(decision); setDecision(null); setComment(""); } });
  };

  return (
    <>
      <OfflineNotice detail="Approving needs a connection." />
      <header className="flex flex-col gap-2.5">
        <span className="t-eyebrow">Milestone</span>
        <h1 className="t-h1">{m.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Tag>{MILESTONE_STATE_LABEL[m.status]}</Tag>
          {m.dueDate && <span>Due {fmtDate(m.dueDate)}</span>}
          {m.approvedAt && <span>Approved {fmtDate(m.approvedAt.slice(0, 10))}</span>}
        </div>
      </header>
      {m.description && <p className="text-base">{m.description}</p>}

      {done === "approve" && <Notice tone="ok">Thank you. The freelancer has been told you approved this milestone.</Notice>}
      {done === "reject" && <Notice tone="warn">You asked for changes. The freelancer has been told.</Notice>}

      {isDecidable(m) && m.approvalRequired && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDecision("approve")} disabled={!online}>Approve milestone</Button>
            <Button variant="outline" onClick={() => setDecision("reject")} disabled={!online}>Request changes</Button>
          </div>
          <p className="t-caption">Approving tells the freelancer they can invoice this milestone. It doesn’t send any money.</p>
        </div>
      )}
      {!isDecidable(m) && !done && m.status !== "approved" && <p className="t-caption">This milestone isn’t waiting for your decision right now.</p>}

      <Dialog open={decision !== null} onOpenChange={close}>
        <DialogContent>
          <DialogTitle>{decision === "reject" ? "Request changes?" : "Approve this milestone?"}</DialogTitle>
          <DialogDescription>{decision === "reject" ? "Tell the freelancer what to change." : "You can add an optional note for the freelancer."}</DialogDescription>
          <Field label={<>Comment <span className="font-normal text-muted-foreground">(optional)</span></>} htmlFor="pm-comment">
            <Textarea id="pm-comment" rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} disabled={mutation.isPending} />
          </Field>
          {error && <Notice tone="error" role="alert">{error.kind === "decision" ? error.message : error.kind === "ratelimited" ? "Too many requests. Try again later." : error.kind === "expired" ? "This link has expired or isn’t valid." : error.message}</Notice>}
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild><Button type="button" variant="outline" disabled={mutation.isPending}>Cancel</Button></DialogClose>
            <Button onClick={confirm} loading={mutation.isPending}>{decision === "reject" ? "Send request" : "Confirm approval"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
