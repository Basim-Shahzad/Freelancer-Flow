import { CardBody, CardHead } from "@/components/ui/section";
import type { Invoice, InvoiceStatus } from "@/lib/types";
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

/**
 * "What happened": vertical timeline, oldest first. Filled dot = it happened; dashed dot = a known date still
 * ahead (or missed). Real events only, no predictions. Gold only for the Paid event. Dots are decorative.
 */
export function EventsTimeline({ invoice, status }: { invoice: Invoice; status: InvoiceStatus }) {
  const items = buildTimeline(invoice, status);
  return (
    <section aria-labelledby="id-ev">
      <CardHead title={<span id="id-ev">What happened</span>} level={3} className="border-t" />
      <CardBody>
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nothing has happened yet.</p>}
        <ol className="relative m-0 flex list-none flex-col gap-4 p-0 before:absolute before:inset-y-2 before:start-[4.5px] before:w-px before:bg-border before:content-['']">
          {items.map((e) => (
            <li key={e.id} className="relative flex gap-3 text-sm">
              <span aria-hidden="true" className="mt-[0.3rem] shrink-0">
                <i className={cn("relative block size-[10px] rounded-full border-2", e.pending ? cn("border-dashed bg-surface", PENDING_DOT[e.tone === "err" ? "err" : "neutral"]) : DOT[e.tone])} />
              </span>
              <div className="min-w-0">
                <div className="leading-snug">{e.label}</div>
                <div className="text-xs text-muted-foreground">{e.when}</div>
              </div>
            </li>
          ))}
        </ol>
      </CardBody>
    </section>
  );
}
