"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { useIsOnline } from "@/lib/hooks/use-online";
import { OfflineNotice, describedBy } from "./form-bits";
import { forgotSchema, type ForgotValues } from "./schemas";

const linkCls = "font-medium text-primary-ink underline decoration-1 underline-offset-[3px]";

/** Password reset has no backend endpoint yet, so this screen is informational and cannot be submitted. */
export function ForgotForm() {
  const online = useIsOnline();
  const { register, formState: { errors } } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
    mode: "onTouched",
  });

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate aria-label="Reset your password" className="flex w-full max-w-[26rem] flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <h1 className="t-h1">Reset your password</h1>
        <p className="text-sm text-muted-foreground [text-wrap:pretty]">Password reset by email is coming soon.</p>
      </div>
      <Notice tone="info">
        <b>Not available yet.</b> We can’t email reset links today. If you’re still logged in on another device, you can change your password in Settings → Account.
      </Notice>
      {!online && <OfflineNotice>You’re offline.</OfflineNotice>}
      <Field label="Email" htmlFor="fp-email" error={errors.email?.message}>
        <Input id="fp-email" type="email" autoComplete="email" placeholder="ayesha@maliks.studio" disabled aria-invalid={!!errors.email} aria-describedby={describedBy("fp-email", errors.email?.message)} {...register("email")} />
      </Field>
      <Button type="submit" block disabled>Send reset link</Button>
      <hr className="m-0 border-0 border-t border-rule" />
      <Link href="/login" className={`${linkCls} self-start text-sm`}>Back to log in</Link>
    </form>
  );
}
