"use client";

import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAppStore } from "@/lib/store";
import { Skeleton } from "@/components/ui/skeleton";

/** Business identity bar for share links. Hidden when printing. */
export function PortalHeader() {
  const hydrated = useHydrated();
  const businessName = useAppStore((s) => s.business.businessName);
  const owner = useAppStore((s) => s.business.ownerName);
  return (
    <header className="flex items-center gap-3 border-b border-rule px-4 py-3 print:hidden">
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full border border-rule font-serif text-base">
        {hydrated ? (businessName.trim().charAt(0).toUpperCase() || "P") : ""}
      </span>
      <div className="flex min-w-0 flex-col">
        {hydrated ? (
          <>
            <span className="truncate font-semibold leading-snug">{businessName}</span>
            <span className="text-xs leading-snug text-muted-foreground">Shared with you by {owner}</span>
          </>
        ) : (
          <>
            <Skeleton className="h-4 w-32" />
            <span className="sr-only">Loading</span>
          </>
        )}
      </div>
    </header>
  );
}
