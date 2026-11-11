"use client";

import { useEffect } from "react";
import type { FieldErrors, FieldValues, UseFormReturn } from "react-hook-form";

/** Dotted name of the first leaf error, in `errors` order (which follows field registration order). */
export function firstErrorName(errors: FieldErrors<FieldValues>, prefix = ""): string | null {
  for (const [key, value] of Object.entries(errors)) {
    if (!value || key === "root") continue;
    const name = prefix ? `${prefix}.${key}` : key;
    if (typeof (value as { message?: unknown }).message === "string" || "type" in (value as object)) return name;
    const nested = firstErrorName(value as FieldErrors<FieldValues>, name);
    if (nested) return nested;
  }
  return null;
}

/**
 * Moves focus to the first invalid field after every submit attempt and after server-side (422) errors are mapped
 * onto fields. Covers custom controls that react-hook-form's own focus handling cannot reach, by falling back to the
 * first `[aria-invalid="true"]` element in the form's DOM.
 */
export function useFocusFirstError<T extends FieldValues>(form: UseFormReturn<T>): void {
  const { submitCount, errors } = form.formState;
  useEffect(() => {
    if (submitCount === 0) return;
    const name = firstErrorName(errors as FieldErrors<FieldValues>);
    if (!name) return;
    const el = document.querySelector<HTMLElement>(`[name="${name}"]`);
    if (el && document.activeElement !== el) { el.focus(); return; }
    if (el) return;
    const invalid = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    invalid?.focus();
  }, [submitCount, errors]);
}
