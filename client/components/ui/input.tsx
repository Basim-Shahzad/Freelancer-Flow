import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        "min-h-11 w-full rounded-lg border border-rule bg-surface px-3 text-base text-foreground placeholder:text-muted-foreground hover:border-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-error",
        className,
      )}
      {...props}
    />
  );
}

/** Input with a fixed prefix/suffix (currency code, %, search icon). */
function InputAffix({ prefix, suffix, className, children }: { prefix?: React.ReactNode; suffix?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex min-h-11 items-stretch overflow-hidden rounded-lg border border-rule bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring", className)}>
      {prefix && <span className="grid place-items-center border-e border-border px-3 text-sm font-semibold tracking-wide text-muted-foreground">{prefix}</span>}
      <div className="min-w-0 flex-1 [&_input]:min-h-0 [&_input]:h-full [&_input]:rounded-none [&_input]:border-0 [&_input]:bg-transparent [&_input]:outline-none [&_input]:focus-visible:outline-none">{children}</div>
      {suffix && <span className="grid place-items-center border-s border-border px-3 text-sm font-semibold text-muted-foreground">{suffix}</span>}
    </div>
  );
}

export { Input, InputAffix };
