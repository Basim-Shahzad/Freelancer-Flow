"use client";

import { ThreadMark } from "@/components/brand";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAppStore } from "@/lib/store";

export function PortalFooter() {
  const hydrated = useHydrated();
  const businessName = useAppStore((s) => s.business.businessName);
  return (
    <footer className="flex flex-col items-center gap-2 border-t border-border px-4 py-5 text-center text-xs text-muted-foreground print:hidden">
      <span>No account needed. This private link was shared{hydrated ? ` by ${businessName}` : " with you"}.</span>
      <span>Paylancr does not process payments. Pay the freelancer directly.</span>
      <span className="inline-flex items-center gap-2"><ThreadMark />Sent with Paylancr</span>
    </footer>
  );
}
