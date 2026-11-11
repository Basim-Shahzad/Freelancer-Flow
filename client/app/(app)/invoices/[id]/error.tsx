"use client";

import { RouteError } from "@/components/domain/route-error";
import { Page } from "@/components/ui/section";

export default function InvoiceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Page>
      <RouteError title="Couldn’t load this invoice" body="The invoice itself is unchanged. Check your connection and try again." reset={reset} secondary={{ label: "Back to invoices", href: "/invoices" }} />
    </Page>
  );
}
