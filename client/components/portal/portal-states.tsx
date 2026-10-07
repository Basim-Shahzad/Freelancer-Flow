import { StateBlock } from "@/components/domain/state-block";
import { Skeleton } from "@/components/ui/skeleton";

export function PortalSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-8">
      <div className="flex flex-col gap-3"><Skeleton className="h-3 w-20" /><Skeleton className="h-10 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
      <Skeleton className="h-16 w-full" />
      <div className="flex flex-col">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-6 border-b border-border py-5"><div className="flex flex-col gap-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-28" /></div><Skeleton className="h-4 w-20" /></div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Unknown, replaced or cancelled link. Locked-style, no way into the owner's app. */
export function LinkInactive({ what }: { what: "project" | "invoice" }) {
  return (
    <StateBlock
      kind="locked"
      title={what === "invoice" ? "This invoice link is no longer active" : "This link is no longer active"}
      body={
        what === "invoice"
          ? "The freelancer cancelled this invoice or replaced the link. Ask them for the latest one."
          : "The freelancer turned off this share link or it has been replaced. Ask them for a new one."
      }
    />
  );
}
