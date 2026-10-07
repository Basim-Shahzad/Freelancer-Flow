"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/select";
import { useIsOnline } from "@/lib/hooks/use-online";
import { useAppStore } from "@/lib/store";
import { InlineError, OfflineNotice, PasswordInput, describedBy, sleep } from "./form-bits";
import { COUNTRIES, COUNTRY_HINT_KEY, signUpSchema, type SignUpValues } from "./schemas";
import { useSignedInRedirect } from "./use-signed-in-redirect";

const linkCls = "font-medium text-primary-ink underline decoration-1 underline-offset-[3px]";

export function SignUpForm() {
  const router = useRouter();
  const online = useIsOnline();
  const signUp = useAppStore((s) => s.signUp);
  const [exists, setExists] = useState(false);
  useSignedInRedirect();

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "", country: "PK", terms: false },
    mode: "onTouched",
  });
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = form;

  const onSubmit = handleSubmit(async (v) => {
    setExists(false);
    await sleep(600);
    const st = useAppStore.getState();
    const taken = [st.session.user?.email, st.business.email].filter(Boolean).map((e) => e?.toLowerCase());
    if (taken.includes(v.email.toLowerCase())) {
      setExists(true);
      form.setError("email", { type: "exists", message: "An account with this email already exists." });
      return;
    }
    try { sessionStorage.setItem(COUNTRY_HINT_KEY, v.country); } catch { /* optional hint only */ }
    signUp({ name: v.name, email: v.email });
    toast.success("Account created. Let’s set up your studio.");
    router.push("/onboarding");
  });

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Create your studio" className="flex w-full max-w-[26rem] flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <h1 className="t-h1">Create your studio</h1>
        <p className="text-sm text-muted-foreground">Free for up to two clients. No card needed.</p>
      </div>

      {!online && <OfflineNotice>You’re offline. Creating an account needs a connection.</OfflineNotice>}

      <Field label="Full name" htmlFor="su-name" error={errors.name?.message}>
        <Input id="su-name" autoComplete="name" placeholder="Ayesha Malik" aria-invalid={!!errors.name} aria-describedby={describedBy("su-name", errors.name?.message)} {...register("name")} />
      </Field>

      <div className="flex flex-col gap-2">
        <Field label="Email" htmlFor="su-email" error={errors.email?.message}>
          <Input id="su-email" type="email" autoComplete="email" placeholder="ayesha@maliks.studio" aria-invalid={!!errors.email} aria-describedby={describedBy("su-email", errors.email?.message)} {...register("email", { onChange: () => setExists(false) })} />
        </Field>
        {exists && <Link href="/login" className={`${linkCls} text-sm`}>Log in instead</Link>}
      </div>

      <Field label="Password" htmlFor="su-pw" error={errors.password?.message} hint="Use a passphrase you don’t use elsewhere.">
        <PasswordInput id="su-pw" autoComplete="new-password" placeholder="10 characters or more" aria-invalid={!!errors.password} aria-describedby={describedBy("su-pw", errors.password?.message, true)} {...register("password")} />
      </Field>

      <Field label="Where do you work from?" htmlFor="su-country" hint="Sets your tax year (Pakistan: July to June) and suggested payment methods. Change it later.">
        <FormSelect id="su-country" aria-describedby="su-country-hint" control={control} name="country" options={COUNTRIES.map((c) => ({ value: c.code, label: c.label }))} />
      </Field>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="su-terms" className="flex font-normal min-h-11 cursor-pointer items-start gap-3 py-1.5 text-sm">
          <Controller
            control={control}
            name="terms"
            render={({ field }) => (
              <Checkbox id="su-terms" className="mt-0.5" checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} onBlur={field.onBlur} aria-invalid={!!errors.terms} aria-describedby={describedBy("su-terms", errors.terms?.message)} />
            )}
          />
          <span>I agree to the <a href="#" className={linkCls}>Terms</a> and <a href="#" className={linkCls}>Privacy Policy</a>.</span>
        </Label>
        {errors.terms?.message && <InlineError id="su-terms-error">{errors.terms.message}</InlineError>}
      </div>

      <Button type="submit" block loading={isSubmitting} disabled={!online}>{isSubmitting ? "Creating account…" : "Create account"}</Button>
      <hr className="m-0 border-0 border-t border-rule" />
      <p className="text-sm text-muted-foreground">Already have an account? <Link href="/login" className={linkCls}>Log in</Link></p>
    </form>
  );
}
