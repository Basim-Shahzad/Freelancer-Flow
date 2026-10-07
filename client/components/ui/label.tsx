"use client";

import * as React from "react";
import { Label as LabelPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root data-slot="label" className={cn("text-sm font-semibold", className)} {...props} />;
}

/** Label + control + hint + error, wired with ids for accessibility. */
export function Field({
  label, htmlFor, hint, error, optional, className, children,
}: { label: React.ReactNode; htmlFor: string; hint?: React.ReactNode; error?: string; optional?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="ms-1 font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {children}
      {hint && !error && <span id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">{hint}</span>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="flex items-center gap-1 text-xs text-error-ink">
          <svg className="size-[1.1em]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5h.01" /></svg>
          {error}
        </p>
      )}
    </div>
  );
}

export { Label };
