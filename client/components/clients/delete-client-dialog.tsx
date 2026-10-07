"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Confirm dialog. Clients with projects or invoices can't be deleted (it would orphan their records). */
export function DeleteClientDialog({ name, projects, invoices, onConfirm }: { name: string; projects: number; invoices: number; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  const blocked = projects > 0 || invoices > 0;
  const parts = [projects > 0 ? `${projects} ${projects === 1 ? "project" : "projects"}` : null, invoices > 0 ? `${invoices} ${invoices === 1 ? "invoice" : "invoices"}` : null].filter(Boolean).join(" and ");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="destructive"><Trash2 aria-hidden="true" />Delete client</Button></DialogTrigger>
      <DialogContent>
        <DialogTitle>{blocked ? `${name} can’t be deleted yet` : `Delete ${name}?`}</DialogTitle>
        <DialogDescription>
          {blocked
            ? `${name} still has ${parts}. Delete or move those first so your records stay complete.`
            : "This removes the client and their contact details. It can’t be undone."}
        </DialogDescription>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <DialogClose asChild><Button variant="outline">{blocked ? "Close" : "Keep client"}</Button></DialogClose>
          {!blocked && <Button variant="destructive" onClick={() => { setOpen(false); onConfirm(); }}>Delete client</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
