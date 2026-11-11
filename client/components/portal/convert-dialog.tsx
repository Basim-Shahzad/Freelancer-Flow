"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { InlineError, PasswordInput } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { Label } from "@/components/ui/label";
import { applyApiFieldErrors } from "@/lib/api/field-errors";
import { usePortalConvert } from "@/lib/hooks/portal";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";

/** "Convert to user account": POST /portal/convert with only a password. A 4xx detail shows inline. */
export function ConvertToUser({ token }: { token: string | null }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const convert = usePortalConvert(token);
  const form = useForm<{ password: string }>({ defaultValues: { password: "" } });
  const err = form.formState.errors.password?.message;

  const change = (next: boolean) => {
    if (convert.isPending) return;
    if (!next) { form.reset(); setFormError(null); }
    setOpen(next);
  };

  const submit = form.handleSubmit((v) => {
    setFormError(null);
    convert.mutate(v.password, {
      onSuccess: () => setDone(true),
      onError: (e) => {
        if (applyApiFieldErrors(form, e)) return;
        setFormError(getApiErrorStatus(e) === 429 ? "Too many attempts. Try again later." : getApiErrorMessage(e, "Couldn’t create your account. Try again."));
      },
    });
  });

  if (done) return <Notice tone="ok" className="print:hidden"><b>Your account is ready.</b> You can now sign in to Paylancr with your email and this password.</Notice>;

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild><Button variant="outline" className="self-start print:hidden">Convert to user account</Button></DialogTrigger>
      <DialogContent>
        <DialogTitle>Create your own account</DialogTitle>
        <DialogDescription>Choose a password to turn this link into a free Paylancr account. Your invoices stay available here either way.</DialogDescription>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pc-pw">Password</Label>
            <PasswordInput id="pc-pw" autoComplete="new-password" disabled={convert.isPending} aria-invalid={err ? true : undefined}
              {...form.register("password", { required: "Enter a password.", minLength: { value: 8, message: "Use at least 8 characters." }, maxLength: { value: 128, message: "Use at most 128 characters." } })} />
            {err && <InlineError id="pc-pw-err">{err}</InlineError>}
            {formError && <InlineError id="pc-form-err">{formError}</InlineError>}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild><Button type="button" variant="outline" disabled={convert.isPending}>Cancel</Button></DialogClose>
            <Button type="submit" loading={convert.isPending}>Create account</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
