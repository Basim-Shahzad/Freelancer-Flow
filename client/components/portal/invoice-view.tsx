"use client";

import { Download } from "lucide-react";
import { useEffect, useRef } from "react";
import { InvoiceDocument } from "@/components/domain/invoice-document";
import { Money } from "@/components/domain/money";
import { StageThread } from "@/components/domain/stage-thread";
import { StatusChip } from "@/components/domain/status-chip";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { fmtDate } from "@/lib/dates";
import { deriveStatus, isLive } from "@/lib/invoice";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAppStore } from "@/lib/store";
import { HowToPay } from "./how-to-pay";
import { dueLine, firstName, invoiceCaption, invoiceHero, isPortalVisible, lastPaymentDate, methodsForInvoice } from "./portal-logic";
import { LinkInactive, PortalSkeleton } from "./portal-states";

export function InvoicePortalView({ token }: { token: string }) {
  const hydrated = useHydrated();
  const invoice = useAppStore((s) => s.invoices.find((i) => i.shareToken === token));
  const allMethods = useAppStore((s) => s.methods);
  const clients = useAppStore((s) => s.clients);
  const projects = useAppStore((s) => s.projects);
  const business = useAppStore((s) => s.business);
  const online = useAppStore((s) => s.online);
  const markViewed = useAppStore((s) => s.markViewed);

  const active = hydrated && invoice && isPortalVisible(invoice) ? invoice : undefined;
  const activeId = active?.id;
  const viewedFor = useRef<string | null>(null);
  // Mark viewed once per opened invoice (the store ignores repeats too).
  useEffect(() => {
    if (activeId && viewedFor.current !== activeId) { viewedFor.current = activeId; markViewed(activeId); }
  }, [activeId, markViewed]);

  if (!hydrated) return <PortalSkeleton />;
  if (!active) return <LinkInactive what="invoice" />;

  const inv = active;
  const owner = firstName(business.ownerName);
  const client = clients.find((c) => c.id === inv.clientId);
  const project = projects.find((p) => p.id === inv.projectId);
  const display = deriveStatus(inv);
  const hero = invoiceHero(inv, display);
  const paid = display === "paid";
  const methods = methodsForInvoice(inv, allMethods);
  const estimateIn = inv.currency === "PKR" ? "USD" : "PKR";

  return (
    <>
      {!online && <Notice tone="warn"><b>You’re offline.</b> Details you’ve already loaded stay here and can be copied.</Notice>}

      <header className="flex flex-col gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="t-eyebrow">Invoice {inv.number}</span>
          <StatusChip status={display} />
        </div>
        <h1 className="sr-only">Invoice {inv.number} from {business.businessName}</h1>
        <span className="text-sm text-muted-foreground">{[client?.name, project?.name, dueLine(inv, display)].filter(Boolean).join(" · ")}</span>
        <span className="t-eyebrow pt-2">{hero.label}</span>
        <Money size="hero" currency={inv.currency} amount={hero.amount} estimateIn={hero.estimate ? estimateIn : undefined} note={hero.estimate} />
        <div className="pt-1">
          <Button variant="outline" onClick={() => window.print()}><Download aria-hidden="true" />Download PDF</Button>
        </div>
      </header>

      <div className="print:hidden"><StageThread stage={paid ? "paid" : "instructions"} caption={invoiceCaption(inv, display)} /></div>

      {isLive(display) && (
        <HowToPay methods={methods} number={inv.number} ownerFirst={owner} />
      )}

      {paid && (
        <Notice tone="ok" className="print:hidden">
          <b>Paid in full on {fmtDate(lastPaymentDate(inv))}.</b> Thank you. Nothing more to do. Keep the PDF for your records.
        </Notice>
      )}
      {display === "written_off" && (
        <Notice tone="info" className="print:hidden"><b>This invoice is closed.</b> No payment is needed. Contact {owner} if you have questions.</Notice>
      )}

      <Section title="Invoice" id="pi-doc" className="print:[&>div]:hidden">
        <InvoiceDocument part="lines" reveal invoice={inv} client={client} business={business} methods={[]} projectName={project?.name} status={display} className="print:border-0 print:p-0" />
      </Section>
    </>
  );
}
