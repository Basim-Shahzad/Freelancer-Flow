import type { Metadata } from "next";
import { PortalFooter } from "@/components/portal/portal-footer";
import { PortalHeader } from "@/components/portal/portal-header";

export const metadata: Metadata = {
  title: "Shared with you",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Client portal: no login, no app shell. Mobile-first single column. */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <PortalHeader />
      <main id="main" tabIndex={-1} className="@container mx-auto flex w-full max-w-[46rem] flex-1 flex-col gap-8 px-4 pb-16 pt-6 outline-none print:max-w-none print:p-0">
        {children}
      </main>
      <PortalFooter />
    </div>
  );
}
