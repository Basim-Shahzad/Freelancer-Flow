"use client";

import { Page } from "@/components/ui/section";
import { StateBlock } from "@/components/domain/state-block";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Page>
      <StateBlock kind="error" title="Couldn’t load your dashboard" body="Your invoices and payments are safe. Check your connection and try again." cta={{ label: "Try again", onClick: reset }} />
    </Page>
  );
}
