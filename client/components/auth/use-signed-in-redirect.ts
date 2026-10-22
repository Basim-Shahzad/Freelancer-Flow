"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { safeNext } from "@/lib/auth/next";
import { useSession } from "@/lib/hooks/auth";
import { useOnboarded } from "@/lib/hooks/profile";

/** Where to go after signing in: the validated `?next=` target, else the dashboard. */
export function readNext(): string {
  if (typeof window === "undefined") return "/dashboard";
  return safeNext(new URLSearchParams(window.location.search).get("next")) ?? "/dashboard";
}

/** Login / signup: bounce already-signed-in, onboarded users to `next` (or the dashboard). */
export function useSignedInRedirect(): void {
  const router = useRouter();
  const { isAuthenticated } = useSession();
  const { ready, onboarded } = useOnboarded();
  useEffect(() => {
    if (isAuthenticated && ready && onboarded) router.replace(readNext());
  }, [isAuthenticated, ready, onboarded, router]);
}
