"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { SelectField } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { MethodDraft } from "@/lib/api/mappers/payment-methods";
import { BANK_SCHEME_ORDER, BANK_SCHEMES, DEFAULT_BANK_SCHEME, METHOD_KINDS, defaultLabel, fieldsFor } from "@/lib/payment-methods";
import type { BankScheme, PaymentMethodKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { MethodErrors } from "./payment-method-errors";

export type { MethodDraft };

interface Props {
  kind: PaymentMethodKind;
  initial?: Partial<MethodDraft>;
  onSubmit: (draft: MethodDraft) => void;
  onCancel?: () => void;
  submitLabel?: string;
  /** Disables the submit button and shows progress while a save is in flight. */
  submitting?: boolean;
  /** Server-side (422) errors to show next to their fields. A field's error clears as soon as it is edited. */
  errors?: MethodErrors | null;
  /** Called on every change (e.g. for a live invoice preview). */
  onChange?: (draft: MethodDraft) => void;
  className?: string;
}

/** A new method starts with its kind's name, except "Other", which has no sensible default. */
const startLabel = (kind: PaymentMethodKind, scheme?: BankScheme) => (kind === "other" ? "" : defaultLabel(kind, scheme));

/**
 * Checks that need no server: required fields, a label, and the "X and/or Y" rules. IBAN/ABA/sort-code/mobile
 * checksums are the server's job and come back through `errors`.
 */
export function validateMethodDraft(draft: MethodDraft): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!draft.label.trim()) errs.label = "Name is required";
  const fields = fieldsFor(draft.kind, draft.scheme);
  for (const f of fields) if (f.required && !draft.fields[f.key]?.trim()) errs[f.key] = `${f.label} is required`;
  const oneOf = METHOD_KINDS[draft.kind].requireOneOf;
  if (oneOf && !oneOf.some((k) => draft.fields[k]?.trim())) {
    const names = oneOf.map((k) => fields.find((f) => f.key === k)?.label ?? k);
    errs[oneOf[0]!] = `Add ${names.join(" or ")}`;
  }
  return errs;
}

/** Data-driven form: fields come from lib/payment-methods.ts. Used by onboarding and Settings. */
export function PaymentMethodForm({ kind, initial, onSubmit, onCancel, submitLabel = "Save method", submitting = false, errors, onChange, className }: Props) {
  const info = METHOD_KINDS[kind];
  const [scheme, setScheme] = useState<BankScheme>(initial?.scheme ?? DEFAULT_BANK_SCHEME);
  const [label, setLabel] = useState(initial?.label ?? startLabel(kind, initial?.scheme));
  const [values, setValues] = useState<Record<string, string>>(initial?.fields ?? {});
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const fields = useMemo(() => fieldsFor(kind, scheme), [kind, scheme]);

  // New server errors replace the old ones: forget which fields were edited since.
  useEffect(() => setEdited(new Set()), [errors]);

  const draftOf = (l: string, v: Record<string, string>, s: BankScheme): MethodDraft => ({ kind, scheme: kind === "bank" ? s : undefined, label: l, fields: v });
  const touch = (key: string) => {
    setClientErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
    setEdited((s) => new Set(s).add(key));
  };
  const set = (key: string, v: string) => {
    const next = { ...values, [key]: v };
    setValues(next);
    touch(key);
    onChange?.(draftOf(label, next, scheme));
  };
  const setName = (v: string) => {
    setLabel(v);
    touch("label");
    onChange?.(draftOf(v, values, scheme));
  };
  const pickScheme = (s: BankScheme) => {
    // Keep an untouched default name in step with the scheme.
    const nextLabel = label === startLabel(kind, scheme) ? startLabel(kind, s) : label;
    setScheme(s);
    setLabel(nextLabel);
    onChange?.(draftOf(nextLabel, values, s));
  };

  const errorFor = (key: string) => clientErrors[key] || (edited.has(key) ? "" : (errors?.fields[key] ?? ""));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const draft = draftOf(label, values, scheme);
    const errs = validateMethodDraft(draft);
    setClientErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit(draft);
  };

  return (
    <form onSubmit={submit} noValidate className={cn("flex flex-col gap-5", className)} aria-label={`${info.label} details`}>
      <div className="flex flex-col gap-1.5">
        <h3 className="t-h3">{info.label}</h3>
        <p className="max-w-[60ch] text-sm text-muted-foreground [text-wrap:pretty]">{info.intro}</p>
      </div>
      {errors?.general && <Notice tone="error">{errors.general}</Notice>}
      {kind === "bank" && (
        <div role="group" aria-label="Account scheme" className="flex flex-wrap gap-2">
          {BANK_SCHEME_ORDER.map((s) => (
            <Button key={s} size="sm" variant={scheme === s ? "primary" : "outline"} aria-pressed={scheme === s} onClick={() => pickScheme(s)}>
              {BANK_SCHEMES[s].label}
            </Button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(14rem,100%),1fr))] gap-4">
        <Field htmlFor={`pm-${kind}-label`} label="Name" hint="Shown to your client above the details." error={errorFor("label")}>
          <Input id={`pm-${kind}-label`} value={label} maxLength={100} placeholder={kind === "other" ? "Cash pickup" : undefined} aria-invalid={!!errorFor("label")} autoComplete="off" onChange={(e) => setName(e.target.value)} />
        </Field>
        {fields.map((f) => {
          const id = `pm-${kind}-${f.key}`;
          const error = errorFor(f.key);
          return (
            <Field key={f.key} htmlFor={id} label={f.label} hint={f.hint} error={error} optional={!f.required} className={f.multiline ? "col-span-full" : undefined}>
              {f.options ? (
                <SelectField id={id} value={values[f.key] ?? ""} placeholder="Choose…" options={f.options} aria-invalid={!!error} onValueChange={(v) => set(f.key, v)} />
              ) : f.multiline ? (
                <Textarea id={id} value={values[f.key] ?? ""} placeholder={f.placeholder} aria-invalid={!!error} onChange={(e) => set(f.key, e.target.value)} />
              ) : (
                <Input id={id} value={values[f.key] ?? ""} placeholder={f.placeholder} aria-invalid={!!error} className="num" autoComplete="off" onChange={(e) => set(f.key, e.target.value)} />
              )}
            </Field>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : submitLabel}</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}
