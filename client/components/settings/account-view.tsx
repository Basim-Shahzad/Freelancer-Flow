"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { changePasswordSchema, type ChangePasswordValues } from "@/components/auth/schemas";
import { OfflineNotice, PasswordInput, describedBy } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { applyApiFieldErrors } from "@/lib/api/field-errors";
import { useChangePassword, useLogoutAll, useSession } from "@/lib/hooks/auth";
import { useApiToast } from "@/lib/hooks/use-api-toast";
import { useIsOnline } from "@/lib/hooks/use-online";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";

export function AccountView() {
  const { user } = useSession();
  return (
    <div className="flex max-w-xl flex-col gap-10">
      <section aria-labelledby="acct-email" className="flex flex-col gap-1">
        <h2 id="acct-email" className="t-h3">Signed in as</h2>
        <p className="text-sm text-muted-foreground">{user?.email ?? "…"}</p>
      </section>
      <ChangePasswordCard />
      <LogoutAllCard />
    </div>
  );
}

function ChangePasswordCard() {
  const router = useRouter();
  const online = useIsOnline();
  const toast = useApiToast();
  const change = useChangePassword();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    mode: "onTouched",
  });
  const { register, handleSubmit, formState: { errors } } = form;

  const onSubmit = handleSubmit(async (v) => {
    setServerError(null);
    try {
      await change.mutateAsync({ currentPassword: v.currentPassword, newPassword: v.newPassword });
    } catch (e) {
      const status = getApiErrorStatus(e);
      if (status === 400 || status === 401) {
        form.setError("currentPassword", { type: "server", message: "That isn’t your current password." }, { shouldFocus: true });
      } else if (!applyApiFieldErrors(form, e)) setServerError(getApiErrorMessage(e));
      return;
    }
    // The hook has already signed this device out (the server revokes every session).
    toast.success("Password changed. Log in again with your new password.");
    router.replace("/login");
  });

  const rootError = serverError ?? errors.root?.message;
  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="acct-pw" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="acct-pw" className="t-h3">Change password</h2>
        <p className="text-sm text-muted-foreground">You’ll be logged out on every device and asked to log in again.</p>
      </div>
      {rootError && <Notice tone="error">{rootError}</Notice>}
      {!online && <OfflineNotice>You’re offline. Changing your password needs a connection.</OfflineNotice>}

      <Field label="Current password" htmlFor="cp-current" error={errors.currentPassword?.message}>
        <PasswordInput id="cp-current" autoComplete="current-password" aria-invalid={!!errors.currentPassword} aria-describedby={describedBy("cp-current", errors.currentPassword?.message)} {...register("currentPassword")} />
      </Field>
      <Field label="New password" htmlFor="cp-new" error={errors.newPassword?.message} hint="8 characters or more.">
        <PasswordInput id="cp-new" autoComplete="new-password" aria-invalid={!!errors.newPassword} aria-describedby={describedBy("cp-new", errors.newPassword?.message, true)} {...register("newPassword")} />
      </Field>
      <Field label="Confirm new password" htmlFor="cp-confirm" error={errors.confirmPassword?.message}>
        <PasswordInput id="cp-confirm" autoComplete="new-password" aria-invalid={!!errors.confirmPassword} aria-describedby={describedBy("cp-confirm", errors.confirmPassword?.message)} {...register("confirmPassword")} />
      </Field>

      <Button type="submit" className="self-start" loading={change.isPending} disabled={!online}>{change.isPending ? "Changing…" : "Change password"}</Button>
    </form>
  );
}

function LogoutAllCard() {
  const router = useRouter();
  const online = useIsOnline();
  const toast = useApiToast();
  const logoutAll = useLogoutAll();
  const [open, setOpen] = useState(false);

  const confirm = () =>
    logoutAll.mutate(undefined, {
      onSuccess: () => toast.success("Logged out of all devices."),
      onError: (e) => toast.error(e, "Couldn’t reach the server, so this device was logged out only."),
      onSettled: () => { setOpen(false); router.replace("/login"); },
    });

  return (
    <section aria-labelledby="acct-all" className="flex flex-col gap-3 border-t border-rule pt-8">
      <h2 id="acct-all" className="t-h3">Log out of all devices</h2>
      <p className="text-sm text-muted-foreground">Ends every active session, including this one. Use it if you lost a device or shared your login.</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button variant="outline" className="self-start" disabled={!online}><LogOut aria-hidden="true" />Log out everywhere</Button></DialogTrigger>
        <DialogContent>
          <DialogTitle>Log out of all devices?</DialogTitle>
          <DialogDescription>You’ll need to log in again here and on every other device.</DialogDescription>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="destructive" loading={logoutAll.isPending} onClick={confirm}>Log out everywhere</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
