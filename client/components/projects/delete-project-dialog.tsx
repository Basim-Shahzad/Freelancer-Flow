"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function DeleteProjectDialog({ name, invoices, onConfirm }: { name: string; invoices: number; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="destructive"><Trash2 aria-hidden="true" />Delete project</Button></DialogTrigger>
      <DialogContent>
        <DialogTitle>Delete {name}?</DialogTitle>
        <DialogDescription>
          This removes the project, its milestones and its client link.
          {invoices > 0 ? ` Its ${invoices === 1 ? "invoice stays" : `${invoices} invoices stay`} in your records but will no longer be linked to a project.` : ""} This can’t be undone.
        </DialogDescription>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <DialogClose asChild><Button variant="outline">Keep project</Button></DialogClose>
          <Button variant="destructive" onClick={() => { setOpen(false); onConfirm(); }}>Delete project</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
