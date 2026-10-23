"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";
import { useAppStore } from "@/lib/store";

/**
 * Confirm dialog. `onConfirm` performs the delete. The server refuses a client that still has projects or invoices
 * (409, possibly 422); its message is shown here and the dialog stays open.
 */
export function DeleteClientDialog({ name, onConfirm }: { name: string; onConfirm: () => Promise<void> }) {
  const online = useAppStore((s) => s.online);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; blocked: boolean } | null>(null);

  const confirm = async () => {
    if (!online) return setError({ message: "You’re offline. Reconnect to delete this client.", blocked: false });
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch (e) {
      const status = getApiErrorStatus(e);
      setError({ message: getApiErrorMessage(e, "Couldn’t delete this client."), blocked: status === 409 || status === 422 });
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
      <DialogTrigger asChild><Button variant="destructive"><Trash2 aria-hidden="true" />Delete client</Button></DialogTrigger>
      <DialogContent>
        <DialogTitle>{error?.blocked ? `${name} can’t be deleted yet` : `Delete ${name}?`}</DialogTitle>
        <DialogDescription>
          {error?.blocked ? "Delete or move their projects and invoices first so your records stay complete." : "This removes the client and their contact details. It can’t be undone."}
        </DialogDescription>
        {error && <Notice tone="error" role="alert">{error.message}</Notice>}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <DialogClose asChild><Button variant="outline" disabled={pending}>{error?.blocked ? "Close" : "Keep client"}</Button></DialogClose>
          {!error?.blocked && <Button variant="destructive" loading={pending} onClick={() => void confirm()}>Delete client</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
