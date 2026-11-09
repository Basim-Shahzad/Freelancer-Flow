"use client";

import { useState } from "react";
import { toast } from "sonner";
import { InlineError, PasswordInput } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { exportErrorMessage, useExportData } from "@/lib/hooks/export/use-export";

/** Asks for the account password (re-verified server-side), then downloads the ZIP. */
export function ExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const exp = useExportData();

  const change = (next: boolean) => {
    if (exp.isPending) return;
    if (!next) { setPassword(""); setError(null); exp.reset(); }
    onOpenChange(next);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return setError("Enter your password to continue.");
    setError(null);
    exp.mutate(password, {
      onSuccess: () => { toast.success("Export downloaded"); change(false); },
      onError: (err) => setError(exportErrorMessage(err)),
    });
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent>
        <DialogTitle>Export my data</DialogTitle>
        <DialogDescription>
          The archive contains decrypted payment details. Keep it somewhere safe and don’t share it. Enter your password to confirm it’s you.
        </DialogDescription>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ex-pw">Password</Label>
            <PasswordInput id="ex-pw" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} aria-invalid={error ? true : undefined} aria-describedby={error ? "ex-pw-err" : undefined} disabled={exp.isPending} />
            {error && <InlineError id="ex-pw-err">{error}</InlineError>}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild><Button type="button" variant="outline" disabled={exp.isPending}>Cancel</Button></DialogClose>
            <Button type="submit" loading={exp.isPending}>{exp.isPending ? "Preparing…" : "Download export"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
