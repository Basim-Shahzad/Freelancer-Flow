"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { loginUrl } from "@/lib/auth/next";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAppStore } from "@/lib/store";
import { useAuthStore } from "@/lib/store/auth";
import { useSession } from "./use-auth";

interface Options {
  /** "app": signed in + onboarded (else bounce). "onboarding": signed in, not yet onboarded. */
  require: "app" | "onboarding";
  /** When true the redirect to the dashboard is skipped (the wizard navigates itself on completion). */
  suspended?: { current: boolean };
}

/**
 * Client-side route protection for the (app) shell and onboarding. Returns `ready`: true only when the
 * page may render. While the session is `idle|loading` (or the persisted store has not hydrated) it returns
 * false and never redirects, so protected content is never flashed and valid sessions are never bounced.
 */
export function useAuthGate({ require, suspended }: Options): boolean {
  const router = useRouter();
  const hydrated = useHydrated();
  const onboarded = useAppStore((s) => s.session.onboarded);
  const { status, isAuthenticated } = useSession();

  useEffect(() => {
    if (!hydrated || suspended?.current) return;
    if (status === "unauthenticated") {
      const { signOutReason, resetSignOutReason } = useAuthStore.getState();
      resetSignOutReason();
      if (signOutReason === "expired") toast.error("Your session expired. Log in again to continue.");
      if (signOutReason === "manual" || require === "onboarding") router.replace("/login");
      else router.replace(loginUrl(window.location.pathname + window.location.search));
    } else if (isAuthenticated) {
      if (require === "app" && !onboarded) router.replace("/onboarding");
      else if (require === "onboarding" && onboarded) router.replace("/dashboard");
    }
  }, [hydrated, status, isAuthenticated, onboarded, require, router, suspended]);

  const ready = hydrated && isAuthenticated;
  return require === "app" ? ready && onboarded : ready && !onboarded;
}
