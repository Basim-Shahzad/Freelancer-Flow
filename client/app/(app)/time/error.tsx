"use client";

import { StateBlock } from "@/components/domain/state-block";
import { Page } from "@/components/ui/section";

export default function TimeError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Page>
      <StateBlock kind="error" title="Couldn’t load your time" body="The request timed out. Entries on this device are safe. Check your connection and try again." cta={{ label: "Try again", onClick: reset }} />
    </Page>
  );
}
