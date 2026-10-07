import { Skeleton } from "@/components/ui/skeleton";

/** Tab-content skeleton shared by loading.tsx and the hydration gate. */
export function SettingsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading settings" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3"><Skeleton className="h-7 w-48" /><Skeleton className="h-3 w-full max-w-md" /></div>
      <div className="flex flex-col">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-6 border-b border-border py-5">
            <div className="flex flex-col gap-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-32" /></div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
