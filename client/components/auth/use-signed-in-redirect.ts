"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { safeNext } from "@/lib/auth/next";
import { useSession } from "@/lib/hooks/auth";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAppStore } from "@/lib/store";

/** Where to go after signing in: the validated `?next=` target, else the dashboard. */
export function readNext(): string {
  if (typeof window === "undefined") return "/dashboard";
  return safeNext(new URLSearchParams(window.location.search).get("next")) ?? "/dashboard";
}

/** Login / signup: bounce already-signed-in, onboarded users to `next` (or the dashboard). */
export function useSignedInRedirect(): void {
  const router = useRouter();
  const hydrated = useHydrated();
  const { isAuthenticated } = useSession();
  const onboarded = useAppStore((s) => s.session.onboarded);
  useEffect(() => {
    if (hydrated && isAuthenticated && onboarded) router.replace(readNext());
  }, [hydrated, isAuthenticated, onboarded, router]);
}
