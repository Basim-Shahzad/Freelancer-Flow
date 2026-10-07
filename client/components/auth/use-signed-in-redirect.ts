"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAppStore } from "@/lib/store";

/** Login / signup: bounce already-signed-in, onboarded users to the dashboard. */
export function useSignedInRedirect(): void {
  const router = useRouter();
  const hydrated = useHydrated();
  const signedIn = useAppStore((s) => s.session.signedIn);
  const onboarded = useAppStore((s) => s.session.onboarded);
  useEffect(() => {
    if (hydrated && signedIn && onboarded) router.replace("/dashboard");
  }, [hydrated, signedIn, onboarded, router]);
}
