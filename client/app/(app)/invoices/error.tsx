"use client";

import { StateBlock } from "@/components/domain/state-block";
import { Page } from "@/components/ui/section";

export default function InvoicesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Page>
      <StateBlock kind="error" title="Couldn’t load invoices" body="The request timed out. Nothing has changed. Check your connection and try again." cta={{ label: "Try again", onClick: reset }} />
    </Page>
  );
}
