"use client";

import { RouteError } from "@/components/domain/route-error";
import { Page } from "@/components/ui/section";

export default function TimeError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Page>
      <RouteError title="Couldn’t load your time" body="Entries on this device are safe. Check your connection and try again." reset={reset} />
    </Page>
  );
}
