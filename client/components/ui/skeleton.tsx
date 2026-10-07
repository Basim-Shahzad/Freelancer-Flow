import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-[shimmer_1.6s_ease-in-out_infinite] rounded-md bg-border", className)} />;
}

/** Generic page skeleton for loading.tsx files. */
export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="@container" role="status" aria-label="Loading">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 @2xl:px-8 @2xl:py-10">
        <div className="flex flex-col gap-3"><Skeleton className="h-3 w-24" /><Skeleton className="h-10 w-64" /></div>
        <div className="flex flex-col gap-0">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-6 border-b border-border py-5"><div className="flex flex-col gap-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-32" /></div><Skeleton className="h-4 w-24" /></div>
          ))}
        </div>
        <span className="sr-only">Loading…</span>
      </div>
    </div>
  );
}
