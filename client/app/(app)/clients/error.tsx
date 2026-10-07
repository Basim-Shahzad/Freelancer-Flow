"use client";

import { Page } from "@/components/ui/section";
import { StateBlock } from "@/components/domain/state-block";

export default function ClientsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Page>
      <StateBlock kind="error" title="Couldn’t load clients" body="Nothing has changed. Check your connection and try again." cta={{ label: "Try again", onClick: reset }} />
    </Page>
  );
}
