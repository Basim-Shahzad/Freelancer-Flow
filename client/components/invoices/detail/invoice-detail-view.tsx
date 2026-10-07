"use client";

import { useState } from "react";
import { toast } from "sonner";
import { InvoiceDocument } from "@/components/domain/invoice-document";
import { StateBlock } from "@/components/domain/state-block";
import { Notice } from "@/components/ui/notice";
import { Card, CardBody, Page, Split } from "@/components/ui/section";
import { PageSkeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/dates";
import { useCopy } from "@/lib/hooks/use-copy";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { calcTotals, deriveStatus, isLive } from "@/lib/invoice";
import { formatMoney } from "@/lib/money";
import { useAppStore } from "@/lib/store";
import type { PaymentMethod } from "@/lib/types";
import { ActionBar, type PanelKind } from "./action-bar";
import { ConfirmPanel } from "./confirm-panel";
import { DetailHeader } from "./detail-header";
import { EventsTimeline } from "./events-timeline";
import { shareLink, shareMessage, whatsappUrl } from "./messages";
import { MoneySummary } from "./money-summary";
import { PaymentsSection } from "./payments-section";
import { PrintStyles } from "./print-styles";
import { RecordPanel } from "./record-panel";
import { RemindPanel } from "./remind-panel";

export function InvoiceDetailView({ id }: { id: string }) {
  const hydrated = useHydrated();
  if (!hydrated) return <PageSkeleton rows={4} />;
  return <DetailScreen id={id} />;
}

function NotFound() {
  return (
    <Page width="narrow">
      <StateBlock kind="empty" title="Invoice not found" body="It may have been deleted, or the link is out of date. Your other invoices are unaffected." cta={{ label: "Back to invoices", href: "/invoices" }} />
    </Page>
  );
}

function DetailScreen({ id }: { id: string }) {
  const invoice = useAppStore((s) => s.invoices.find((i) => i.id === id));
  const clients = useAppStore((s) => s.clients);
  const projects = useAppStore((s) => s.projects);
  const methods = useAppStore((s) => s.methods);
  const business = useAppStore((s) => s.business);
  const online = useAppStore((s) => s.online);
  const sendInvoice = useAppStore((s) => s.sendInvoice);
  const [panel, setPanel] = useState<PanelKind | null>(null);
  const { copied, copy } = useCopy();

  if (!invoice) return <NotFound />;

  const status = deriveStatus(invoice);
  const t = calcTotals(invoice);
  const client = clients.find((c) => c.id === invoice.clientId);
  const project = projects.find((p) => p.id === invoice.projectId);
  const docMethods = invoice.paymentMethodIds.map((mid) => methods.find((m) => m.id === mid)).filter((m): m is PaymentMethod => Boolean(m));
  const link = () => shareLink(window.location.origin, invoice.shareToken);
  const togglePanel = (p: PanelKind) => setPanel((cur) => (cur === p ? null : p));
  const close = () => setPanel(null);

  const sendEmail = () => {
    sendInvoice(invoice.id, "email");
    toast.success(`${invoice.number} sent`, { description: client?.email ? `Emailed to ${client.email}` : undefined });
  };
  const shareWhatsApp = () => {
    const text = shareMessage({
      contactName: client?.contactName ?? "there", ownerName: business.ownerName, businessName: business.businessName, number: invoice.number,
      amount: formatMoney(t.balance || t.total, invoice.currency), dueDate: fmtDate(invoice.dueDate), link: link(),
    });
    sendInvoice(invoice.id, "whatsapp");
    window.open(whatsappUrl(client?.whatsapp, text), "_blank", "noopener,noreferrer");
    toast.success("Opened in WhatsApp", { description: "Press send in WhatsApp to share it." });
  };
  const copyLink = () => {
    void copy("link", link());
    sendInvoice(invoice.id, "link");
    toast.success("Link copied", { description: "Your client sees payment instructions only. There is no pay button." });
  };
  const print = () => {
    const prev = document.title;
    document.title = `${invoice.number} · ${business.businessName}`;
    const restore = () => { document.title = prev; window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore);
    window.print();
  };

  const live = isLive(status);
  return (
    <Page>
      <PrintStyles />
      <div className="flex flex-col gap-6 print:hidden">
        <DetailHeader invoice={invoice} status={status} total={t.total} paid={t.paid} balance={t.balance} client={client} project={project} onPrint={print} />
        {!online && <Notice tone="warn" role="status"><b>You’re offline.</b> Sending, reminders and recording payments are paused. Copy link and Print / PDF still work.</Notice>}
        {panel === "record" && live && <RecordPanel invoice={invoice} balance={t.balance} methods={methods.filter((m) => m.enabled || invoice.paymentMethodIds.includes(m.id))} onClose={close} />}
        {panel === "remind" && live && <RemindPanel invoice={invoice} status={status} balance={t.balance} client={client} onClose={close} />}
        {(panel === "writeoff" || panel === "reverse" || panel === "void") && <ConfirmPanel key={panel} kind={panel} invoice={invoice} balance={t.balance} onClose={close} />}
      </div>

      <Split className="gap-6">
        <Card data-print-area className="min-w-0 print:rounded-none print:border-0">
          <InvoiceDocument invoice={invoice} client={client} business={business} methods={docMethods} projectName={project?.name} className="rounded-none border-0 print:p-0" />
        </Card>
        <aside className="min-w-0 print:hidden @4xl:sticky @4xl:top-6" aria-label="Actions, payments and activity">
          <Card className="@4xl:max-h-[calc(100dvh-3rem)] @4xl:overflow-y-auto">
            <CardBody>
              <ActionBar
                status={status} offline={!online} copied={copied === "link"} panel={panel}
                onSendEmail={sendEmail} onWhatsApp={shareWhatsApp} onCopy={copyLink} onPanel={togglePanel}
              />
            </CardBody>
            <PaymentsSection invoice={invoice} canReverse={status !== "void"} offline={!online} />
            <EventsTimeline invoice={invoice} status={status} />
            <MoneySummary totals={t} currency={invoice.currency} taxPercent={invoice.taxPercent} />
          </Card>
        </aside>
      </Split>
    </Page>
  );
}
