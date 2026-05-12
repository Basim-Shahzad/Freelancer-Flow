"use client";

import { useAuthStore } from "@/stores/useAuthStore";
import ProfilePictureFromName from "@/components/ProfilePictureFromName";
import { Skeleton } from "@heroui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
   SquarePen,
   Search,
   ChevronDown,
   Inbox,
   CircleDot,
   LayoutGrid,
   Eye,
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
            isActive ? "bg-white/8 text-white" : "text-white/50 hover:bg-white/5 hover:text-white/80",
         )}>
         <Icon
            className={cn(
               "shrink-0 transition-colors duration-100",
               isActive ? "text-white/80" : "text-white/30 group-hover:text-white/60",
            )}
            size={14}
         />
         {label}
      </Link>
   );
}

function SectionLabel({ label }: { label: string }) {
   return (
      <div className="flex items-center gap-0.5 px-2 pt-3 pb-1 cursor-pointer group">
         <span className="text-[11px] font-medium text-white/30 uppercase tracking-wider select-none group-hover:text-white/50 transition-colors duration-100">
            {label}
         </span>
         <ChevronDown
            size={10}
            className="text-white/25 group-hover:text-white/45 transition-colors duration-100 mt-px"
         />
      </div>
   );
}

function TopBar() {
   const isInitialized = useAuthStore((s) => s.isInitialized);
   const user = useAuthStore((s) => s.user);

   return (
      <div className="px-3 pt-3 pb-2 flex items-center justify-between border-b border-white/[0.05]">
         {isInitialized ? (
            <button className="flex items-center gap-1.5 px-2 py-1 rounded-[6px] hover:bg-white/5 transition-colors duration-100 max-w-[140px]">
               <ProfilePictureFromName name={user?.username ?? ""} scale={0.55} />
               <span className="text-[13px] text-white/90 truncate">{user?.username}</span>
               <ChevronDown size={12} className="text-white/40 shrink-0" />
            </button>
         ) : (
            <div className="flex items-center gap-1.5 px-2 py-1">
               <Skeleton animationType="pulse" className="h-5 w-5 rounded-full shrink-0" />
               <Skeleton animationType="pulse" className="h-4 w-24 rounded-full" />
            </div>
         )}

         <div className="flex items-center gap-0.5">
            <button className="p-1.5 rounded-[5px] text-white/35 hover:text-white/70 hover:bg-white/6 transition-colors duration-100">
               <Search size={14} />
            </button>
            <button className="p-1.5 rounded-[5px] text-white/35 hover:text-white/70 hover:bg-white/6 transition-colors duration-100">
               <SquarePen size={14} />
            </button>
         </div>
      </div>
   );
}

// ─────────────────────────────────────────────
// Main sidebar
// ─────────────────────────────────────────────
export default function Sidebar() {
   return (
      <aside className="flex flex-col w-full h-full bg-black border-r border-white/5 overflow-y-auto overflow-x-hidden">
         <TopBar />

         <nav className="flex flex-col px-2 py-1 gap-0.5 mt-1">
            {globalNav.map((item) => (
               <NavItem key={item.href} {...item} />
            ))}
         </nav>

         <div className="px-2 mt-1">
            <SectionLabel label="Workspace" />
            <div className="flex flex-col gap-0.5">
               {workspaceNav.map((item) => (
                  <NavItem key={item.href} {...item} />
               ))}
            </div>
         </div>

         <div className="mt-auto px-4 py-3 border-t border-white/[0.04]">
            <button className="flex items-center gap-1.5 text-[12px] text-white/25 hover:text-white/45 transition-colors duration-100">
               <MoreHorizontal size={13} />
               More
            </button>
         </div>
      </aside>
   );
}
