import { ThreadMark } from "@/components/brand";

export function PortalFooter() {
  return (
    <footer className="flex flex-col items-center gap-2 border-t border-border px-4 py-5 text-center text-xs text-muted-foreground print:hidden">
      <span>No account needed. This private link was shared with you.</span>
      <span>Paylancr does not process payments. Pay the freelancer directly.</span>
      <span className="inline-flex items-center gap-2"><ThreadMark />Sent with Paylancr</span>
    </footer>
  );
}
