import * as React from "react";
import Link from "next/link";
import { CloudOff, Inbox, Loader2, Lock, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Kind = "empty" | "loading" | "error" | "offline" | "locked";
const ICON = { empty: Inbox, loading: Loader2, error: TriangleAlert, offline: CloudOff, locked: Lock } as const;

interface Props {
  kind: Kind;
  title?: string;
  body?: string;
  cta?: { label: string; href?: string; onClick?: () => void };
  secondary?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}

const DEFAULTS: Record<Kind, { title: string; body: string }> = {
  empty: { title: "Nothing here yet", body: "When there is something to show, it will appear here." },
  loading: { title: "Loading…", body: "Fetching the latest. This usually takes a moment." },
  error: { title: "Something went wrong", body: "Nothing has changed. Check your connection and try again." },
  offline: { title: "You’re offline", body: "You can keep logging time. Everything syncs when you reconnect." },
  locked: { title: "Not available on your plan", body: "Upgrade to use this feature." },
};

/** One component for empty / loading / error / offline / locked states. */
export function StateBlock({ kind, title, body, cta, secondary, className }: Props) {
  const Icon = ICON[kind];
  const d = DEFAULTS[kind];
  const render = (a: NonNullable<Props["cta"]>, variant: "primary" | "outline") =>
    a.href ? <Button asChild variant={variant}><Link href={a.href}>{a.label}</Link></Button> : <Button variant={variant} onClick={a.onClick}>{a.label}</Button>;
  return (
    <div role={kind === "error" ? "alert" : "status"} className={cn("flex flex-col items-start gap-4 border-y border-rule py-10", className)}>
      <Icon className={cn("size-6 text-muted-foreground", kind === "loading" && "animate-spin", kind === "error" && "text-error-ink")} aria-hidden="true" strokeWidth={1.5} />
      <div className="flex max-w-prose flex-col gap-2">
        <h2 className="t-h3">{title ?? d.title}</h2>
        <p className="text-sm text-muted-foreground [text-wrap:pretty]">{body ?? d.body}</p>
      </div>
      {(cta || secondary) && (
        <div className="flex flex-wrap gap-2">
          {cta && render(cta, "primary")}
          {secondary && render(secondary, "outline")}
        </div>
      )}
    </div>
  );
}
