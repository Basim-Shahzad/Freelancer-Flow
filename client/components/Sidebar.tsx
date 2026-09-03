"use client";

import { useAuthStore } from "@/features/auth/store";
import { useMe } from "@/features/auth/hooks";
import ProfilePictureFromName from "@/components/ProfilePictureFromName";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
   SquarePen,
   Search,
   ChevronDown,
   Inbox,
   CircleDot,
   LayoutGrid,
   MoreHorizontal,
   Users,
   FileText,
   Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const globalNav = [
   { label: "Dashboard", href: `/dashboard`, icon: CircleDot },
   { label: "Inbox", href: "/inbox", icon: Inbox },
];

export const workspaceNav = [
   { label: "Projects", href: `/projects`, icon: LayoutGrid },
   { label: "Clients", href: `/clients`, icon: Users },
   { label: "Invoices", href: `/invoices`, icon: FileText },
   { label: "Time Tracking", href: `/time-tracking`, icon: Clock },
];

function NavItem({
   href,
   label,
   icon: Icon,
   indent = false,
}: {
   href: string;
   label: string;
   icon: React.ElementType;
   indent?: boolean;
}) {
   const pathname = usePathname();
   const isActive = pathname === href || pathname.startsWith(href + "/");

   return (
      <Link
         href={href}
         className={cn(
            "group flex items-center gap-2 rounded-[6px] px-2 py-[5px] text-[13px] transition-colors duration-100 select-none",
            indent && "ml-3",
            isActive ? "bg-primary/10 text-primary" : "text-text-muted hover:bg-surface hover:text-text"
         )}>
         <Icon
            className={cn(
               "shrink-0 transition-colors duration-100",
               isActive ? "text-primary" : "text-text-muted/60 group-hover:text-text"
            )}
            size={14}
         />
         {label}
      </Link>
   );
}

function SectionLabel({ label }: { label: string }) {
   return (
      <div className="group flex cursor-pointer items-center gap-0.5 px-2 pt-3 pb-1">
         <span className="text-[11px] font-medium tracking-wider text-text-muted/70 uppercase transition-colors duration-100 select-none group-hover:text-text-muted">
            {label}
         </span>
         <ChevronDown
            size={10}
            className="mt-px text-text-muted/50 transition-colors duration-100 group-hover:text-text-muted"
         />
      </div>
   );
}

function TopBar() {
   const user = useAuthStore((s) => s.user);
   const { isLoading } = useMe();

   return (
      <div className="flex items-center justify-between border-b border-border px-3 pt-3 pb-2">
         {!isLoading && user ? (
            <button className="flex max-w-[140px] items-center gap-1.5 rounded-[6px] px-2 py-1 transition-colors duration-100 hover:bg-surface">
               <ProfilePictureFromName name={user?.fullName ?? ""} scale={0.55} />
               <span className="truncate text-[13px] text-text">{user?.fullName}</span>
               <ChevronDown size={12} className="shrink-0 text-text-muted" />
            </button>
         ) : (
            <div className="flex items-center gap-1.5 px-2 py-1">
               <Skeleton className="size-5 shrink-0 rounded-full" />
               <Skeleton className="h-4 w-24 rounded-full" />
            </div>
         )}

         <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon-sm" className="text-text-muted hover:text-text">
               <Search size={14} />
            </Button>
            <Button variant="ghost" size="icon-sm" className="text-text-muted hover:text-text">
               <SquarePen size={14} />
            </Button>
         </div>
      </div>
   );
}

// ─────────────────────────────────────────────
// Main sidebar
// ─────────────────────────────────────────────
export default function Sidebar() {
   return (
      <aside className="flex h-full w-full flex-col overflow-x-hidden overflow-y-auto border-r border-border bg-background">
         <TopBar />

         <nav className="mt-1 flex flex-col gap-0.5 px-2 py-1">
            {globalNav.map((item) => (
               <NavItem key={item.href} {...item} />
            ))}
         </nav>

         <div className="mt-1 px-2">
            <SectionLabel label="Workspace" />
            <div className="flex flex-col gap-0.5">
               {workspaceNav.map((item) => (
                  <NavItem key={item.href} {...item} />
               ))}
            </div>
         </div>

         <div className="mt-auto border-t border-border px-4 py-3">
            <button className="flex items-center gap-1.5 text-[12px] text-text-muted/70 transition-colors duration-100 hover:text-text-muted">
               <MoreHorizontal size={13} />
               More
            </button>
         </div>
      </aside>
   );
}
