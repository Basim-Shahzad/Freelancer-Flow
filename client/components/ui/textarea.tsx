import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full resize-y rounded-lg border border-rule bg-surface px-3 py-3 text-base text-foreground placeholder:text-muted-foreground hover:border-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-error",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
