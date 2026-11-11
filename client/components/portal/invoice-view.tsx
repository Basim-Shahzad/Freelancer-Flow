"use client";

import { Download } from "lucide-react";
import { OfflineNotice } from "@/components/dashboard/offline-notice";
import { InvoiceDocument } from "@/components/domain/invoice-document";
import { Money } from "@/components/domain/money";
import { StageThread } from "@/components/domain/stage-thread";
import { StatusChip } from "@/components/domain/status-chip";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { fmtDate } from "@/lib/dates";
import { counterpartOf, NO_PROCESSING } from "@/lib/fx";
import { isLive } from "@/lib/invoice";
import { toDocInvoice, issuerToBusiness } from "@/lib/invoice-doc";
import { FxRatesProvider } from "@/lib/hooks/exchange-rates";
import { usePortalInvoice, usePortalInvoicePdf } from "@/lib/hooks/portal";
import { usePortalToken } from "@/lib/portal/token";
import { getApiErrorMessage } from "@/lib/services/api.service";
import { ConvertToUser } from "./convert-dialog";
import { HowToPay } from "./how-to-pay";
import { dueLine, firstName, invoiceCaption, invoiceHero, lastPaymentDate } from "./portal-logic";
import { MissingToken, PortalErrorState, PortalSkeleton } from "./portal-states";
import { BLANK_BUSINESS } from "./blank-business";

export function InvoicePortalView({ id }: { id: string }) {
  const token = usePortalToken();
  const query = usePortalInvoice(id, token);
  const pdf = usePortalInvoicePdf(id, token, "invoice.pdf");

  if (!token) return <MissingToken what="invoice" />;
  if (query.isPending) return <PortalSkeleton />;
  if (query.isError) return <PortalErrorState error={query.error} what="invoice" onRetry={() => void query.refetch()} />;

  const { invoice: inv, rates } = query.data;
  const business = issuerToBusiness(inv.issuer, BLANK_BUSINESS);
  const owner = firstName(business.ownerName);
  const display = inv.status;
  const hero = invoiceHero(inv, display);
  const paid = display === "paid";
  const estimateIn = counterpartOf(inv.currency);

  return (
    <FxRatesProvider rates={rates}>
      <OfflineNotice detail="Details you’ve already loaded stay here and can be copied." />

      <header className="flex flex-col gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="t-eyebrow">Invoice {inv.number}</span>
          <StatusChip status={display} />
        </div>
        <h1 className="sr-only">Invoice {inv.number} from {business.businessName || business.ownerName || "the freelancer"}</h1>
        <span className="text-sm text-muted-foreground">{[inv.client.name, inv.project.name, dueLine(inv, display)].filter(Boolean).join(" · ")}</span>
        <span className="t-eyebrow pt-2">{hero.label}</span>
        <Money size="hero" currency={inv.currency} amount={hero.amount} estimateIn={hero.estimate ? estimateIn : undefined} note={hero.estimate} />
        <div className="flex flex-col gap-2 pt-1">
          <Button variant="outline" className="self-start" loading={pdf.isPending} onClick={() => pdf.mutate()}><Download aria-hidden="true" />Download PDF</Button>
          {pdf.isError && <Notice tone="error" role="alert">{getApiErrorMessage(pdf.error, "Couldn’t download the PDF. Try again.")}</Notice>}
        </div>
      </header>

      <div className="print:hidden"><StageThread stage={paid ? "paid" : "instructions"} caption={invoiceCaption(inv, display)} /></div>

      {isLive(display) && <HowToPay methods={inv.methods} number={inv.number} ownerFirst={owner} />}

      <p className="t-caption print:hidden">{NO_PROCESSING}{inv.paymentDisclaimer ? ` ${inv.paymentDisclaimer}` : ""}</p>

      {paid && (
        <Notice tone="ok" className="print:hidden">
          <b>Paid in full on {fmtDate(lastPaymentDate(inv))}.</b> Thank you. Nothing more to do. Keep the PDF for your records.
        </Notice>
      )}
      {display === "written_off" && (
        <Notice tone="info" className="print:hidden"><b>This invoice is closed.</b> No payment is needed. Contact {owner} if you have questions.</Notice>
      )}

      <Section title="Invoice" id="pi-doc" className="print:[&>div]:hidden">
        <InvoiceDocument part="lines" reveal invoice={toDocInvoice(inv)} client={{ name: inv.client.name, companyName: "", address: "" }} business={business} methods={[]} projectName={inv.project.name} className="print:border-0 print:p-0" />
      </Section>

      <ConvertToUser token={token} />
    </FxRatesProvider>
  );
}
