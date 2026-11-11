"use client";

import { RouteError } from "@/components/domain/route-error";
import { Page } from "@/components/ui/section";

export default function InvoicesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Page>
      <RouteError title="Couldn’t load invoices" body="Nothing has changed. Check your connection and try again." reset={reset} />
    </Page>
  );
}
