"use client";

import { StateBlock } from "@/components/domain/state-block";
import { Page } from "@/components/ui/section";

export default function InvoiceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Page>
      <StateBlock kind="error" title="Couldn’t load this invoice" body="The request timed out. The invoice itself is unchanged. Check your connection and try again." cta={{ label: "Try again", onClick: reset }} secondary={{ label: "Back to invoices", href: "/invoices" }} />
    </Page>
  );
}
