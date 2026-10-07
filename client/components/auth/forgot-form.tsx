"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useIsOnline } from "@/lib/hooks/use-online";
import { OfflineNotice, describedBy, sleep } from "./form-bits";
import { forgotSchema, type ForgotValues } from "./schemas";

const linkCls = "font-medium text-primary-ink underline decoration-1 underline-offset-[3px]";
const RESEND_SECONDS = 45;

export const formatCountdown = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function ForgotForm() {
  const online = useIsOnline();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [resending, setResending] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
    mode: "onTouched",
  });

  useEffect(() => { if (sentTo) headingRef.current?.focus(); }, [sentTo]);
  const counting = left > 0;
  useEffect(() => {
    if (!sentTo || !counting) return;
    const t = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [sentTo, counting]);

  const onSubmit = handleSubmit(async (v) => {
    await sleep(600);
    setSentTo(v.email);
    setLeft(RESEND_SECONDS);
  });

  const resend = async () => {
    setResending(true);
    await sleep(600);
    setResending(false);
    setLeft(RESEND_SECONDS);
    toast.success("Reset link sent again.");
  };

  if (sentTo) {
    return (
      <div role="status" className="flex w-full max-w-[26rem] flex-col gap-6">
        <Mail className="size-8 text-success-ink" strokeWidth={1.5} aria-hidden="true" />
        <div className="flex flex-col gap-2.5">
          <h1 ref={headingRef} tabIndex={-1} className="t-h1 outline-none">Check your inbox</h1>
          <p className="text-sm text-muted-foreground [text-wrap:pretty]">
            If an account exists for <b className="font-semibold text-foreground">{sentTo}</b>, a reset link is on its way. It expires in 60 minutes. Look in spam if it doesn’t arrive.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link href="/login">Back to log in</Link></Button>
          <Button variant="ghost" disabled={left > 0 || !online} loading={resending} onClick={resend}>
            {left > 0 ? `Resend in ${formatCountdown(left)}` : "Resend link"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Reset your password" className="flex w-full max-w-[26rem] flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <h1 className="t-h1">Reset your password</h1>
        <p className="text-sm text-muted-foreground [text-wrap:pretty]">Enter the email you signed up with. We’ll send a link that works for 60 minutes.</p>
      </div>
      {!online && <OfflineNotice>You’re offline. Reconnect to send a reset link.</OfflineNotice>}
      <Field label="Email" htmlFor="fp-email" error={errors.email?.message}>
        <Input id="fp-email" type="email" autoComplete="email" placeholder="ayesha@maliks.studio" aria-invalid={!!errors.email} aria-describedby={describedBy("fp-email", errors.email?.message)} {...register("email")} />
      </Field>
      <Button type="submit" block loading={isSubmitting} disabled={!online}>{isSubmitting ? "Sending…" : "Send reset link"}</Button>
      <hr className="m-0 border-0 border-t border-rule" />
      <Link href="/login" className={`${linkCls} self-start text-sm`}>Back to log in</Link>
    </form>
  );
}
