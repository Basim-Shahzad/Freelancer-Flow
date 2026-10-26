import { Button } from "@/components/ui/button";
import { CardBody, CardHead } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/services/api.service";
import type { InvoiceDetail, InvoiceStatus, InvoiceTimelineEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { EventTone } from "./messages";
import { buildTimeline } from "./timeline";

const DOT: Record<EventTone, string> = {
  neutral: "border-primary bg-primary",
  ok: "border-success bg-success",
  warn: "border-warning bg-warning",
  err: "border-error bg-error",
  gold: "border-accent bg-accent",
};
const PENDING_DOT: Record<"neutral" | "err", string> = { neutral: "border-muted-foreground", err: "border-error" };

interface Props {
  invoice: InvoiceDetail;
  status: InvoiceStatus;
  events: InvoiceTimelineEvent[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}

/**
 * "What happened": vertical timeline, oldest first. Filled dot = it happened; dashed dot = a known date still
 * ahead (or missed). Real events only, no predictions. Gold only for the Paid event. Dots are decorative.
 */
export function EventsTimeline({ invoice, status, events, isLoading, error, onRetry }: Props) {
  const items = events ? buildTimeline(invoice, events, status) : [];
  return (
    <section aria-labelledby="id-ev" aria-busy={isLoading}>
      <CardHead title={<span id="id-ev">What happened</span>} level={3} className="border-t" />
      <CardBody>
        {isLoading && <div role="status" aria-label="Loading activity" className="flex flex-col gap-3"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /></div>}
        {!events && !isLoading && (
          <div role="alert" className="flex flex-col items-start gap-2 text-sm">
            <span className="text-muted-foreground">{getApiErrorMessage(error, "Couldn’t load the activity.")}</span>
            <Button variant="outline" onClick={onRetry}>Try again</Button>
          </div>
        )}
        {events && (
          <ol className="relative m-0 flex list-none flex-col gap-4 p-0 before:absolute before:inset-y-2 before:start-[4.5px] before:w-px before:bg-border before:content-['']">
            {items.map((e) => (
              <li key={e.id} className="relative flex gap-3 text-sm">
                <span aria-hidden="true" className="mt-[0.3rem] shrink-0">
                  <i className={cn("relative block size-[10px] rounded-full border-2", e.pending ? cn("border-dashed bg-surface", PENDING_DOT[e.tone === "err" ? "err" : "neutral"]) : DOT[e.tone])} />
                </span>
                <div className="min-w-0">
                  <div className="leading-snug">{e.label}</div>
                  <div className="text-xs text-muted-foreground">{e.when}</div>
                  {e.detail && <div className="break-words text-xs text-muted-foreground">{e.detail}</div>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </section>
  );
}
