"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BANK_SCHEMES, METHOD_KINDS, fieldsFor } from "@/lib/payment-methods";
import type { BankScheme, PaymentMethod, PaymentMethodKind } from "@/lib/types";
import { cn } from "@/lib/utils";

export type MethodDraft = Pick<PaymentMethod, "kind" | "scheme" | "fields" | "label">;

interface Props {
  kind: PaymentMethodKind;
  initial?: Partial<MethodDraft>;
  onSubmit: (draft: MethodDraft) => void;
  onCancel?: () => void;
  submitLabel?: string;
  /** Called on every change (e.g. for a live invoice preview). */
  onChange?: (draft: MethodDraft) => void;
  className?: string;
}

/** Data-driven form: fields come from lib/payment-methods.ts. Used by onboarding and Settings. */
export function PaymentMethodForm({ kind, initial, onSubmit, onCancel, submitLabel = "Save method", onChange, className }: Props) {
  const info = METHOD_KINDS[kind];
  const [scheme, setScheme] = useState<BankScheme>(initial?.scheme ?? "iban");
  const [values, setValues] = useState<Record<string, string>>(initial?.fields ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fields = useMemo(() => fieldsFor(kind, scheme), [kind, scheme]);

  const emit = (v: Record<string, string>, s: BankScheme) => onChange?.({ kind, scheme: kind === "bank" ? s : undefined, fields: v, label: initial?.label });
  const set = (key: string, v: string) => {
    const next = { ...values, [key]: v };
    setValues(next);
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
    emit(next, scheme);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    for (const f of fields) if (f.required && !values[f.key]?.trim()) errs[f.key] = `${f.label} is required`;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const clean = Object.fromEntries(fields.map((f) => [f.key, (values[f.key] ?? "").trim()]).filter(([, v]) => v));
    onSubmit({ kind, scheme: kind === "bank" ? scheme : undefined, fields: clean, label: initial?.label });
  };

  return (
    <form onSubmit={submit} noValidate className={cn("flex flex-col gap-5", className)} aria-label={`${info.label} details`}>
      <div className="flex flex-col gap-1.5">
        <h3 className="t-h3">{info.label}</h3>
        <p className="max-w-[60ch] text-sm text-muted-foreground [text-wrap:pretty]">{info.intro}</p>
      </div>
      {kind === "bank" && (
        <div role="group" aria-label="Account scheme" className="flex flex-wrap gap-2">
          {(Object.keys(BANK_SCHEMES) as BankScheme[]).map((s) => (
            <Button key={s} size="sm" variant={scheme === s ? "primary" : "outline"} aria-pressed={scheme === s} onClick={() => { setScheme(s); emit(values, s); }}>
              {BANK_SCHEMES[s].label}
            </Button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(14rem,100%),1fr))] gap-4">
        {fields.map((f) => {
          const id = `pm-${kind}-${f.key}`;
          return (
            <Field key={f.key} htmlFor={id} label={f.label} hint={f.hint} error={errors[f.key]} optional={!f.required} className={f.multiline ? "col-span-full" : undefined}>
              {f.multiline ? (
                <Textarea id={id} value={values[f.key] ?? ""} placeholder={f.placeholder} aria-invalid={!!errors[f.key]} onChange={(e) => set(f.key, e.target.value)} />
              ) : (
                <Input id={id} value={values[f.key] ?? ""} placeholder={f.placeholder} aria-invalid={!!errors[f.key]} className="num" autoComplete="off" onChange={(e) => set(f.key, e.target.value)} />
              )}
            </Field>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit">{submitLabel}</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}
