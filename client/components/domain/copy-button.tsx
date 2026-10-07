"use client";

import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Copy button with a "Copied" confirmation. Pair with useCopy(). */
export function CopyButton({ label, copied, onCopy, className }: { label: string; copied: boolean; onCopy: () => void; className?: string }) {
  return (
    <Button variant="outline" size="sm" onClick={onCopy} aria-label={copied ? `${label} copied` : `Copy ${label}`} className={cn("min-h-11 min-w-[5.5rem]", className)}>
      {copied ? <><Check className="text-success-ink" aria-hidden="true" />Copied</> : <><Copy aria-hidden="true" />Copy</>}
      <span aria-live="polite" className="sr-only">{copied ? "Copied to clipboard" : ""}</span>
    </Button>
  );
}
