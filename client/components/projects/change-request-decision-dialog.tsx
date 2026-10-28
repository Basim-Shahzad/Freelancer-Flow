"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { decisionToUpdate } from "@/lib/api/mappers/change-requests";
import { useDecideChangeRequest } from "@/lib/hooks/change-requests";
import { useApiToast } from "@/lib/hooks/use-api-toast";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";
import type { ChangeRequest, ChangeRequestStatus } from "@/lib/types";

export type Decision = Exclude<ChangeRequestStatus, "pending">;

const COPY: Record<Decision, { title: string; body: string; cta: string; done: string }> = {
  approved: { title: "Approve", body: "Record that this extra work is agreed.", cta: "Approve", done: "approved" },
  rejected: { title: "Reject", body: "Record that this extra work is declined.", cta: "Reject", done: "rejected" },
  withdrawn: { title: "Withdraw", body: "Record that this request is dropped.", cta: "Withdraw", done: "withdrawn" },
};

interface Props {
  changeRequest: ChangeRequest | null;
  decision: Decision;
  onOpenChange: (open: boolean) => void;
}

/** Approve, reject or withdraw one pending scope change, with an optional note. Decisions are final. */
export function ChangeRequestDecisionDialog({ changeRequest, decision, onOpenChange }: Props) {
  const toast = useApiToast();
  const decide = useDecideChangeRequest();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[decision];
  useEffect(() => { setNote(""); setError(null); }, [changeRequest?.id, decision]);

  const submit = () => {
    if (!changeRequest) return;
    decide.mutate({ id: changeRequest.id, body: decisionToUpdate(decision, note) }, {
      onSuccess: () => { toast.success(`“${changeRequest.title}” ${copy.done}`); onOpenChange(false); },
      onError: (e) => {
        const status = getApiErrorStatus(e);
        if (status === 404) { toast.error(e, "This scope change no longer exists."); onOpenChange(false); return; }
        setError(getApiErrorMessage(e));
      },
    });
  };

  return (
    <Dialog open={changeRequest !== null} onOpenChange={(o) => { if (!decide.isPending) onOpenChange(o); }}>
      <DialogContent>
        <DialogTitle>{copy.title} “{changeRequest?.title}”?</DialogTitle>
        <DialogDescription>{copy.body} A decision can’t be changed afterwards.</DialogDescription>
        {error && <Notice tone="error" role="alert">{error}</Notice>}
        <Field label="Note" htmlFor="cr-note" optional>
          <Textarea id="cr-note" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <DialogClose asChild><Button variant="outline" disabled={decide.isPending}>Not yet</Button></DialogClose>
          <Button variant={decision === "approved" ? "primary" : "outline"} loading={decide.isPending} onClick={submit}>{copy.cta}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
