"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, InputAffix } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/utils";

/** `aria-describedby` target ids match the ones <Field> renders. */
export const describedBy = (id: string, error?: string, hint?: boolean) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(
  ({ id, className, ...props }, ref) => {
    const [show, setShow] = React.useState(false);
    return (
      <InputAffix
        className={cn("aria-[invalid=true]:border-error", className)}
        suffix={
          <Button
            variant="ghost"
            aria-label={show ? "Hide password" : "Show password"}
            aria-controls={id}
            onClick={() => setShow((s) => !s)}
            className="-mx-3 h-full rounded-none px-3"
          >
            {show ? "Hide" : "Show"}
          </Button>
        }
      >
        <Input ref={ref} id={id} type={show ? "text" : "password"} className="text-start" {...props} />
      </InputAffix>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export function OfflineNotice({ children }: { children: React.ReactNode }) {
  return <Notice tone="warn" role="status">{children}</Notice>;
}

export function InlineError({ id, children }: { id: string; children: React.ReactNode }) {
  return <p id={id} role="alert" className="flex items-center gap-1 text-xs text-error-ink">{children}</p>;
}
