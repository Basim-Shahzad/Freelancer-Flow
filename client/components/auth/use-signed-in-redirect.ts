"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/hooks/auth";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAppStore } from "@/lib/store";

/** Login / signup: bounce already-signed-in, onboarded users to the dashboard. */
export function useSignedInRedirect(): void {
  const router = useRouter();
  const hydrated = useHydrated();
  const { isAuthenticated } = useSession();
  const onboarded = useAppStore((s) => s.session.onboarded);
  useEffect(() => {
    if (hydrated && isAuthenticated && onboarded) router.replace("/dashboard");
  }, [hydrated, isAuthenticated, onboarded, router]);
}
