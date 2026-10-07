import { Clock, FileText, FolderKanban, LayoutDashboard, Settings, Users, type LucideIcon } from "lucide-react";

export interface NavItem { href: string; label: string; icon: LucideIcon; match?: string[] }
export interface NavGroup { label?: string; items: NavItem[] }

/** Phase 1 navigation. (Phase 2 items such as Tax and ESFCA are intentionally absent.) */
export const NAV: NavGroup[] = [
  { items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Work to payment",
    items: [
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/time", label: "Time", icon: Clock },
      { href: "/invoices", label: "Invoices", icon: FileText },
    ],
  },
  { label: "Studio", items: [{ href: "/settings", label: "Settings", icon: Settings }] },
];

export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
