"use client";

import { useEffect } from "react";
import { StateBlock } from "@/components/domain/state-block";

export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <StateBlock
      kind="error"
      title="Couldn’t load this page"
      body="The page timed out. Nothing you’ve done is lost. Check your connection and try again, or ask the freelancer to resend the link."
      cta={{ label: "Try again", onClick: reset }}
    />
  );
}
