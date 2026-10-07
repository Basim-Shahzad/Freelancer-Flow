"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Notice } from "@/components/ui/notice";
import { useAppStore } from "@/lib/store";

export const SETTINGS_TABS = [
  { href: "/settings/business", label: "Business profile" },
  { href: "/settings/payment-methods", label: "Payment methods" },
  { href: "/settings/export", label: "Export my data" },
  { href: "/settings/activity", label: "Activity log" },
] as const;

/** Tab-style navigation: each tab is a real route link with aria-current. */
export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings sections" className="border-b border-rule">
      <ul className="m-0 flex list-none gap-6 overflow-x-auto p-0">
        {SETTINGS_TABS.map((t) => {
          const current = pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <li key={t.href} className="shrink-0">
              <Link
                href={t.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-11 items-center whitespace-nowrap border-b-2 border-transparent text-sm font-medium text-muted-foreground no-underline hover:text-foreground",
                  current && "border-foreground font-bold text-foreground",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SettingsOfflineNotice() {
  const online = useAppStore((s) => s.online);
  if (online) return null;
  return (
    <Notice tone="warn">
      <b>You’re offline.</b> You can keep editing; changes are kept on this device. Requesting a data export needs a connection.
    </Notice>
  );
}
