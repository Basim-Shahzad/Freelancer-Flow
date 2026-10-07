import { Ban, CheckCircle2, Circle, CircleAlert, CircleDashed, Clock, CircleSlash } from "lucide-react";
import type { InvoiceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAP: Record<InvoiceStatus, { label: string; Icon: typeof Circle; cls: string; strike?: boolean }> = {
  draft: { label: "Draft", Icon: CircleDashed, cls: "border-dashed border-rule bg-transparent text-muted-foreground" },
  unpaid: { label: "Unpaid", Icon: Clock, cls: "bg-warning-tint border-[color-mix(in_srgb,var(--warning)_50%,var(--border))] [&_svg]:text-warning-ink" },
  partial: { label: "Partially paid", Icon: Circle, cls: "bg-primary-tint border-[color-mix(in_srgb,var(--primary)_50%,var(--border))] [&_svg]:text-primary-ink" },
  paid: { label: "Paid", Icon: CheckCircle2, cls: "bg-success-tint border-[color-mix(in_srgb,var(--success)_50%,var(--border))] [&_svg]:text-success-ink" },
  overdue: { label: "Overdue", Icon: CircleAlert, cls: "bg-error-tint border-[color-mix(in_srgb,var(--error)_55%,var(--border))] [&_svg]:text-error-ink" },
  written_off: { label: "Written off", Icon: CircleSlash, cls: "border-border bg-transparent text-muted-foreground", strike: true },
  void: { label: "Void", Icon: Ban, cls: "border-border bg-transparent text-muted-foreground", strike: true },
};

/** Status is always icon + label, never colour alone. */
export function StatusChip({ status, className }: { status: InvoiceStatus; className?: string }) {
  const { label, Icon, cls, strike } = MAP[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-surface py-[0.1875rem] pe-2.5 ps-2 text-xs font-semibold leading-[1.3] text-foreground", cls, className)}>
      <Icon className="size-[1.1em]" strokeWidth={1.5} aria-hidden="true" {...(status === "partial" ? { fill: "currentColor", fillOpacity: 0.35 } : {})} />
      <span className={cn(strike && "line-through decoration-1")}>{label}</span>
    </span>
  );
}

export const statusLabel = (s: InvoiceStatus) => MAP[s].label;
