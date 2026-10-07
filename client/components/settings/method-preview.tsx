"use client";

import { useMemo } from "react";
import { InvoiceDocument } from "@/components/domain/invoice-document";
import type { MethodDraft } from "@/components/domain/payment-method-form";
import { useAppStore } from "@/lib/store";
import type { PaymentMethod } from "@/lib/types";
import { pickPreviewInvoice, sampleInvoice } from "./preview-methods";

/** Sticky "what your client sees" preview, built from a real recent invoice. Disabled methods are excluded by the caller. */
export function MethodPreview({ methods }: { methods: PaymentMethod[] }) {
  const invoices = useAppStore((s) => s.invoices);
  const clients = useAppStore((s) => s.clients);
  const business = useAppStore((s) => s.business);
  const invoice = useMemo(() => pickPreviewInvoice(invoices) ?? sampleInvoice(business), [invoices, business]);
  const client = clients.find((c) => c.id === invoice.clientId);
  return (
    <aside aria-label="Live invoice preview" className="flex flex-col gap-2 @4xl:sticky @4xl:top-4">
      <span className="t-eyebrow">Live preview · what your client sees</span>
      <InvoiceDocument part="payments" invoice={invoice} client={client} business={business} methods={methods} />
      <p className="t-caption">
        Shown with enabled methods only, in this order. Account numbers are masked here; your client sees them in full on the share link.
      </p>
    </aside>
  );
}

export type { MethodDraft };
