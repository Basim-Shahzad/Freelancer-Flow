import { Archive, CheckCircle2, CircleDashed, CircleDot, PauseCircle, XCircle } from "lucide-react";
import type { ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "./logic";

const MUTED = "border-border bg-background text-muted-foreground";
const MAP = {
  draft: { Icon: CircleDashed, cls: MUTED },
  active: { Icon: CircleDot, cls: "border-[color-mix(in_srgb,var(--primary)_50%,var(--border))] bg-primary-tint text-primary-ink" },
  paused: { Icon: PauseCircle, cls: "border-[color-mix(in_srgb,var(--warning)_50%,var(--border))] bg-warning-tint text-warning-ink" },
  completed: { Icon: CheckCircle2, cls: "border-[color-mix(in_srgb,var(--success)_50%,var(--border))] bg-success-tint text-success-ink" },
  archived: { Icon: Archive, cls: MUTED },
  cancelled: { Icon: XCircle, cls: MUTED },
} satisfies Record<ProjectStatus, { Icon: typeof CircleDot; cls: string }>;

/** Project status as icon + label (never colour alone). */
export function ProjectStatusChip({ status, className }: { status: ProjectStatus; className?: string }) {
  const { Icon, cls } = MAP[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border py-[0.1875rem] pe-2.5 ps-2 text-xs font-semibold leading-[1.3]", cls, className)}>
      <Icon className="size-[1.1em]" strokeWidth={1.5} aria-hidden="true" />{STATUS_LABEL[status]}
    </span>
  );
}
