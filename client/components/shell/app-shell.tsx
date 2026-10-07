"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { GlobalTimer } from "./global-timer";
import { NAV, isActive } from "./nav";
import { OfflineBadge } from "./offline-badge";
import { Sidebar, SidebarNav } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

const COLLAPSE_KEY = "paylancr-sidebar-collapsed";

/** Redirects signed-out users to /login and un-onboarded users to /onboarding. */
function useAuthGate() {
  const router = useRouter();
  const hydrated = useAppStore((s) => s.hydrated);
  const session = useAppStore((s) => s.session);
  useEffect(() => {
    if (!hydrated) return;
    if (!session.signedIn) router.replace("/login");
    else if (!session.onboarded) router.replace("/onboarding");
  }, [hydrated, session.signedIn, session.onboarded, router]);
  return hydrated && session.signedIn && session.onboarded;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const ready = useAuthGate();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch { /* ignore */ } }, []);
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1"); } catch { /* ignore */ } return !c; });

  const tabs = [
    { href: "/dashboard", label: "Overview", icon: NAV[0]!.items[0]!.icon },
    ...NAV[1]!.items.filter((i) => i.href === "/time" || i.href === "/invoices" || i.href === "/projects"),
  ];

  return (
    <div className="flex min-h-dvh">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop top bar: global timer, offline badge, theme, account */}
        <header className="sticky top-0 z-30 hidden flex-wrap items-center gap-x-4 gap-y-3 border-b border-border bg-background px-5 py-3 lg:flex">
          <GlobalTimer className="flex-[1_1_24rem]" />
          <div className="ms-auto flex items-center gap-2"><OfflineBadge /><ThemeToggle /><UserMenu /></div>
        </header>

        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex flex-col border-b border-border bg-background lg:hidden">
          <div className="flex items-center gap-1 py-1.5 pe-2 ps-1">
            <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu aria-hidden="true" /></Button>
            <Logo className="text-xl" />
            <div className="ms-auto flex items-center gap-1"><ThemeToggle /><UserMenu /></div>
          </div>
          <div className="px-3 pb-3"><OfflineBadge /></div>
          <GlobalTimer compact className="border-t border-border px-4 py-3" />
        </header>

        <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
          <DialogContent side="start" className="gap-6 p-6">
            <DialogTitle className="sr-only">Menu</DialogTitle>
            <DialogDescription className="sr-only">Navigate Paylancr</DialogDescription>
            <Logo />
            <SidebarNav onNavigate={() => setMenuOpen(false)} />
          </DialogContent>
        </Dialog>

        <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-16 outline-none lg:pb-0">
          {ready ? children : <PageSkeleton />}
        </main>

        <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-background lg:hidden">
          {tabs.map((t) => {
            const active = isActive(pathname, t.href);
            const Icon = t.icon;
            return (
              <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-semibold text-muted-foreground no-underline", active && "text-foreground shadow-[inset_0_2px_0_var(--foreground)]")}>
                <Icon className="size-[22px]" strokeWidth={1.5} aria-hidden="true" />{t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
