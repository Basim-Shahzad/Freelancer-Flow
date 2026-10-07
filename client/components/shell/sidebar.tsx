"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { deriveStatus } from "@/lib/invoice";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { NAV, isActive } from "./nav";

/**
 * The sidebar is a table of contents on a vertical thread: each destination is a node on
 * a hairline; the current page is the filled node. Collapsed mode shows icons only.
 */
export function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const overdue = useAppStore((s) => s.invoices.filter((i) => deriveStatus(i) === "overdue").length);

  return (
    <nav aria-label="Primary" className={cn("flex w-full flex-col gap-6", collapsed && "items-center")}>
      {NAV.map((g, gi) => (
        <div key={gi} className={cn("flex w-full flex-col gap-1", collapsed && "items-center")}>
          {g.label && !collapsed && (
            <span className="t-eyebrow mb-1 flex items-center gap-3 ps-0.5 after:flex-1 after:border-t after:border-border after:content-['']">{g.label}</span>
          )}
          <div className={cn("relative flex flex-col", !collapsed && "before:absolute before:inset-y-5 before:start-[11px] before:w-px before:bg-border before:content-['']")}>
            {g.items.map((n) => {
              const active = isActive(pathname, n.href);
              const Icon = n.icon;
              const link = (
                <Link
                  href={n.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex min-h-10 items-center gap-3 rounded-lg font-serif text-[1.0625rem] leading-tight tracking-[-0.005em] text-muted-foreground no-underline hover:text-foreground",
                    active && "font-medium text-foreground",
                    collapsed && "min-h-11 w-11 justify-center hover:bg-hover",
                    collapsed && active && "shadow-[inset_2px_0_0_var(--foreground)] rounded-s-none",
                  )}
                >
                  {collapsed ? (
                    <Icon className="size-5" strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <span className="relative z-[1] grid w-[23px] shrink-0 place-items-center" aria-hidden="true">
                      <i className={cn("block size-[7px] rounded-full border border-rule bg-background transition-all duration-200 group-hover:border-foreground group-hover:bg-foreground", active && "size-[11px] border-primary bg-primary shadow-[0_0_0_4px_var(--primary-tint)] group-hover:border-primary group-hover:bg-primary")} />
                    </span>
                  )}
                  {!collapsed && <span>{n.label}</span>}
                  {!collapsed && n.href === "/invoices" && overdue > 0 && (
                    <span className="ms-auto font-sans text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">{overdue} overdue</span>
                  )}
                </Link>
              );
              return collapsed ? (
                <Tooltip key={n.href}><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent side="right">{n.label}</TooltipContent></Tooltip>
              ) : <div key={n.href}>{link}</div>;
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      aria-label="Sidebar"
      className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col gap-6 overflow-y-auto border-e border-border bg-background px-4 py-6 transition-[width] duration-200 ease-out-soft lg:flex", collapsed ? "w-[4.5rem] items-center px-3" : "w-60")}
    >
      <Logo hideText={collapsed} />
      <SidebarNav collapsed={collapsed} />
      <Button variant="ghost" size={collapsed ? "icon" : "default"} onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} className={cn("mt-auto", !collapsed && "justify-start text-muted-foreground")}>
        {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <><PanelLeftClose aria-hidden="true" />Collapse</>}
      </Button>
    </aside>
  );
}
