"use client";

import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { ASIDE_LINES, AuthAside } from "./auth-aside";

/** Split layout: aside on wide containers, simple header on mobile. Onboarding brings its own frame. */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path.startsWith("/onboarding")) return <>{children}</>;
  const line = path.startsWith("/login") ? ASIDE_LINES.login : path.startsWith("/forgot-password") ? ASIDE_LINES.forgot : ASIDE_LINES.default;
  return (
    <div className="@container">
      <div className="grid min-h-dvh @4xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <AuthAside line={line} className="hidden flex-col justify-between gap-12 border-e border-border bg-background px-14 py-12 @4xl:flex" />
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center justify-between px-5 py-3 @4xl:justify-end">
            <Logo className="text-xl @4xl:hidden" />
            <ThemeToggle />
          </div>
          <main id="main" tabIndex={-1} className="flex flex-1 items-start justify-center px-5 pb-10 pt-4 outline-none @4xl:items-center @4xl:p-12">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
