"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";
import { useAppStore } from "@/lib/store";

/**
 * Confirm dialog. `onConfirm` performs the delete. The server refuses a project that has invoices (409): its
 * message is shown and the dialog stays open, pointing at archiving instead.
 */
export function DeleteProjectDialog({ name, onConfirm }: { name: string; onConfirm: () => Promise<void> }) {
  const online = useAppStore((s) => s.online);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; blocked: boolean } | null>(null);

  const confirm = async () => {
    if (!online) return setError({ message: "You’re offline. Reconnect to delete this project.", blocked: false });
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch (e) {
      setError({ message: getApiErrorMessage(e, "Couldn’t delete this project."), blocked: getApiErrorStatus(e) === 409 });
    } finally {
      setPending(false);
    }
  };

  const change = (next: boolean) => {
    if (pending) return;
    setOpen(next);
    if (!next) setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild><Button variant="destructive"><Trash2 aria-hidden="true" />Delete project</Button></DialogTrigger>
      <DialogContent>
        <DialogTitle>{error?.blocked ? `${name} can’t be deleted` : `Delete ${name}?`}</DialogTitle>
        <DialogDescription>
          {error?.blocked
            ? "A project with invoices has to stay in your records. Set its status to Archived instead."
            : "This removes the project and its milestones. This can’t be undone."}
        </DialogDescription>
        {error && <Notice tone="error" role="alert">{error.message}</Notice>}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <DialogClose asChild><Button variant="outline" disabled={pending}>{error?.blocked ? "Close" : "Keep project"}</Button></DialogClose>
          {!error?.blocked && <Button variant="destructive" loading={pending} onClick={() => void confirm()}>Delete project</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
