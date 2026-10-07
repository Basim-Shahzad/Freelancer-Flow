"use client";

import { useEffect } from "react";
import { Logo } from "@/components/brand";
import { StateBlock } from "@/components/domain/state-block";

export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-8 px-4 py-10">
      <Logo />
      <StateBlock
        kind="error"
        title="Something went wrong on our side"
        body="Nothing you entered has been lost or changed. Try again, or head back to your dashboard."
        cta={{ label: "Try again", onClick: reset }}
        secondary={{ label: "Go to dashboard", href: "/dashboard" }}
      />
      {error.digest && <p className="t-caption num">Reference: {error.digest}</p>}
    </main>
  );
}
