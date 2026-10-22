"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { loginUrl, onboardingUrl } from "@/lib/auth/next";
import { useOnboarded } from "@/lib/hooks/profile";
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
 * page may render. While the session is `idle|loading` (or the profile that decides "onboarded" is still loading)
 * it returns false and never redirects, so protected content is never flashed and valid sessions are never bounced.
 */
export function useAuthGate({ require, suspended }: Options): boolean {
  const router = useRouter();
  const { ready: profileReady, onboarded } = useOnboarded();
  const { status, isAuthenticated } = useSession();

  useEffect(() => {
    if (suspended?.current) return;
    if (status === "unauthenticated") {
      const { signOutReason, resetSignOutReason } = useAuthStore.getState();
      resetSignOutReason();
      if (signOutReason === "expired") toast.error("Your session expired. Log in again to continue.");
      if (signOutReason === "manual" || require === "onboarding") router.replace("/login");
      else router.replace(loginUrl(window.location.pathname + window.location.search));
    } else if (isAuthenticated && profileReady) {
      if (require === "app" && !onboarded) router.replace(onboardingUrl(window.location.pathname + window.location.search));
      else if (require === "onboarding" && onboarded) router.replace("/dashboard");
    }
  }, [status, isAuthenticated, profileReady, onboarded, require, router, suspended]);

  const ready = isAuthenticated && profileReady;
  // While the wizard is finishing, the profile turns "onboarded" under it; keep it mounted so a failed step can be retried.
  return require === "app" ? ready && onboarded : ready && (!onboarded || !!suspended?.current);
}
