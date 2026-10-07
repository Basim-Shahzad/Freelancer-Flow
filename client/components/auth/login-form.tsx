"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Switch } from "@/components/ui/switch";
import { useIsOnline } from "@/lib/hooks/use-online";
import { useLogin } from "@/lib/hooks/auth";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";
import { OfflineNotice, PasswordInput, describedBy } from "./form-bits";
import { logInSchema, type LogInValues } from "./schemas";
import { useSignedInRedirect } from "./use-signed-in-redirect";

const linkCls = "font-medium text-primary-ink underline decoration-1 underline-offset-[3px]";

export function LogInForm() {
  const router = useRouter();
  const online = useIsOnline();
  const login = useLogin();
  const [bad, setBad] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  useSignedInRedirect();

  const { register, control, handleSubmit, formState: { errors } } = useForm<LogInValues>({
    resolver: zodResolver(logInSchema),
    defaultValues: { email: "", password: "", keep: true },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (v) => {
    setBad(false);
    setServerError(null);
    try {
      await login.mutateAsync({ email: v.email, password: v.password });
    } catch (e) {
      const status = getApiErrorStatus(e);
      if (status === 401 || status === 400) setBad(true);
      else setServerError(getApiErrorMessage(e));
      return;
    }
    toast.success("Welcome back.");
    router.push("/dashboard"); // AppShell sends un-onboarded users on to /onboarding
  });

  const invalid = bad || undefined;
  return (
    <form onSubmit={onSubmit} noValidate aria-label="Log in" className="flex w-full max-w-[26rem] flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <h1 className="t-h1">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Log in to pick up where you left off.</p>
      </div>

      {bad && <Notice tone="error">That email and password don’t match. Check them and try again, or <Link href="/forgot-password" className={linkCls}>reset your password</Link>.</Notice>}
      {serverError && <Notice tone="error">{serverError}</Notice>}
      {!online && <OfflineNotice>You’re offline. If you’re already logged in on this device, the timer keeps running and syncs later.</OfflineNotice>}

      <Field label="Email" htmlFor="li-email" error={errors.email?.message}>
        <Input id="li-email" type="email" autoComplete="email" placeholder="ayesha@maliks.studio" aria-invalid={!!errors.email || invalid} aria-describedby={describedBy("li-email", errors.email?.message)} {...register("email")} />
      </Field>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor="li-pw" className="text-sm font-semibold">Password</Label>
          <Link href="/forgot-password" className={`${linkCls} text-sm`}>Forgot password?</Link>
        </div>
        <PasswordInput id="li-pw" autoComplete="current-password" aria-invalid={!!errors.password || invalid} aria-describedby={describedBy("li-pw", errors.password?.message)} {...register("password")} />
        {errors.password?.message && <p id="li-pw-error" role="alert" className="text-xs text-error-ink">{errors.password.message}</p>}
      </div>

      <Controller control={control} name="keep" render={({ field }) => (
        <Switch label="Keep me logged in on this device" checked={field.value} onCheckedChange={field.onChange} />
      )} />

      <Button type="submit" block loading={login.isPending} disabled={!online}>{login.isPending ? "Logging in…" : "Log in"}</Button>
      <hr className="m-0 border-0 border-t border-rule" />
      <p className="text-sm text-muted-foreground">New to Paylancr? <Link href="/signup" className={linkCls}>Create your studio</Link></p>
    </form>
  );
}
