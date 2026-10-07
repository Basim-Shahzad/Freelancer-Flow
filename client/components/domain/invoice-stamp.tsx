import type { InvoiceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export type StampTone = "primary" | "gold" | "error" | "warning" | "quiet" | "draft";

/** Stamp word + tone per display status. "unpaid" reads SENT: the invoice is out with the client. */
export function stampFor(status: InvoiceStatus): { label: string; tone: StampTone } {
  switch (status) {
    case "draft": return { label: "Draft", tone: "draft" };
    case "unpaid": return { label: "Sent", tone: "primary" };
    case "partial": return { label: "Part-paid", tone: "warning" };
    case "paid": return { label: "Paid", tone: "gold" };
    case "overdue": return { label: "Overdue", tone: "error" };
    case "written_off": return { label: "Written off", tone: "quiet" };
    case "void": return { label: "Void", tone: "quiet" };
  }
}

/** Gold is allowed here ONLY for the Paid moment. */
export const STAMP_CLASS: Record<StampTone, string> = {
  primary: "border-primary text-primary-ink",
  gold: "border-accent text-[color-mix(in_srgb,var(--accent)_55%,var(--foreground))]",
  error: "border-error text-error-ink",
  warning: "border-warning text-warning-ink",
  quiet: "border-rule text-muted-foreground",
  draft: "border-dashed border-rule text-muted-foreground",
};

/** Decorative rotated stamp. The real status is always available as text elsewhere, so it is hidden from assistive tech. */
export function InvoiceStamp({ status, className }: { status: InvoiceStatus; className?: string }) {
  const { label, tone } = stampFor(status);
  return (
    <span
      aria-hidden="true"
      data-stamp={tone}
      className={cn("inline-block -rotate-[4deg] select-none whitespace-nowrap rounded-md border-2 px-3 py-1 text-sm font-semibold uppercase leading-tight tracking-[0.22em]", STAMP_CLASS[tone], className)}
    >
      {label}
    </span>
  );
}
