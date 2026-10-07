"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/** Warn on tab close / reload while a form has unsaved edits. */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

/** "Discard your changes?" confirm used by Cancel buttons on dirty forms. */
export function DiscardDialog({ open, onOpenChange, onDiscard }: { open: boolean; onOpenChange: (o: boolean) => void; onDiscard: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Discard your changes?</DialogTitle>
        <DialogDescription>You have edits that haven’t been saved. If you leave now they will be lost.</DialogDescription>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <DialogClose asChild><Button variant="outline">Keep editing</Button></DialogClose>
          <Button variant="destructive" onClick={onDiscard}>Discard changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** aria-describedby for a field that may show an error or a hint. */
export const describedBy = (id: string, error: string | undefined, hasHint: boolean) => (error ? `${id}-error` : hasHint ? `${id}-hint` : undefined);
