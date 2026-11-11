"use client";

import { RouteError } from "@/components/domain/route-error";

// No console logging here: portal URLs and errors can carry the access token.
export default function PortalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      title="Couldn’t load this page"
      body="Nothing you’ve done is lost. Check your connection and try again, or ask the freelancer to resend the link."
      reset={reset}
    />
  );
}
