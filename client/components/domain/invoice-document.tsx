import { Money } from "@/components/domain/money";
import { statusLabel } from "@/components/domain/status-chip";
import { InvoiceStamp } from "@/components/domain/invoice-stamp";
import { Tag } from "@/components/ui/tag";
import { NO_PROCESSING } from "@/lib/fx";
import { calcTotals, deriveStatus, lineAmount } from "@/lib/invoice";
import { formatAmount } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { fieldsFor, maskValue, methodTitle } from "@/lib/payment-methods";
import type { BusinessProfile, Client, Currency, Invoice, InvoiceStatus, PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  invoice: Invoice;
  client?: Client;
  business: BusinessProfile;
  /** Methods selected on the invoice, in display order. */
  methods: PaymentMethod[];
  projectName?: string;
  /** full = PDF layout; payments = only "How to pay"; lines = everything except payment instructions. */
  part?: "full" | "payments" | "lines";
  /** Override the status shown (defaults to derived). */
  status?: InvoiceStatus;
  /** Show real values instead of masked ones (client-facing views). */
  reveal?: boolean;
  /** Currency for the labelled reference-rate estimate (defaults to USD<->PKR). */
  estimateIn?: Currency;
  /** Show the rotated status stamp (default true on parts that include the header). */
  stamp?: boolean;
  className?: string;
}

/**
 * The invoice "paper". The on-screen preview and the PDF share this layout, so what the
 * freelancer sees is what the client receives. Money Rule: no pay button, a reference-rate
 * estimate with disclaimer, and the "does not process payments" line.
 */
export function InvoiceDocument({ invoice, client, business, methods, projectName, part = "full", status, reveal = false, estimateIn: estimateInProp, stamp = true, className }: Props) {
  const t = calcTotals(invoice);
  const st = status ?? deriveStatus(invoice);
  const showTop = part !== "payments";
  const showPay = part !== "lines";
  const estimateIn: Currency = estimateInProp ?? (invoice.currency === "PKR" ? "USD" : "PKR");
  const paidOrPartial = t.paid > 0 && st !== "written_off";

  return (
    <article aria-label={`Invoice ${invoice.number}`} className={cn("@container flex flex-col gap-8 rounded-[14px] border border-border bg-surface p-5 text-sm leading-normal text-foreground @md:p-8", className)}>
      {showTop && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-serif text-2xl font-medium leading-tight tracking-tight @md:text-3xl">{business.businessName}</span>
              <span className="text-sm text-muted-foreground">{[business.ownerName, business.email].filter(Boolean).join(" · ")}</span>
              <span className="text-xs text-muted-foreground">{[business.address, business.taxId && `NTN ${business.taxId}`].filter(Boolean).join(" · ")}</span>
            </div>
            <div className="flex flex-col items-end gap-2.5 pe-1">
              {stamp && <InvoiceStamp status={st} />}
              <span className="num text-sm text-muted-foreground"><span className="sr-only">Status: {statusLabel(st)}. </span>Invoice {invoice.number}</span>
            </div>
          </div>

          <div className="grid gap-6 @lg:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="t-eyebrow">Billed to</span>
              <span className="font-semibold">{client?.name ?? "—"}</span>
              {client && <span className="text-sm text-muted-foreground">{client.contactName}</span>}
              {client && <span className="text-sm text-muted-foreground">{client.city}, {client.country}</span>}
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="t-eyebrow">Project</span>
              <span className="font-semibold">{projectName ?? "—"}</span>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="t-eyebrow">Dates</span>
              <span className="num text-sm">Issued <b className="font-semibold">{fmtDate(invoice.issueDate)}</b></span>
              <span className="num text-sm">Due <b className="font-semibold">{fmtDate(invoice.dueDate)}</b></span>
              {client && <span className="text-sm text-muted-foreground">{client.termsDays === 0 ? "Due on receipt" : `Net ${client.termsDays}`}</span>}
            </div>
          </div>

          <div>
            <div className="hidden grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_6.5rem] gap-3 border-b border-rule pb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground @md:grid">
              <span>Description</span><span className="num text-end">Qty</span><span className="num text-end">Unit price</span><span className="num text-end">Amount</span>
            </div>
            {invoice.lines.map((l) => (
              <div key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-border py-3 @md:grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_6.5rem]">
                <span>{l.description}</span>
                <span className="num col-start-1 row-start-2 text-xs text-muted-foreground @md:col-start-auto @md:row-start-auto @md:text-end @md:text-sm @md:text-foreground">{l.qty}{l.source?.type === "time" ? " h" : ""}</span>
                <span className="num hidden text-end @md:block">{formatAmount(l.rate, invoice.currency)}</span>
                <span className="num col-start-2 row-start-1 text-end @md:col-start-auto @md:row-start-auto">{formatAmount(lineAmount(l), invoice.currency)}</span>
              </div>
            ))}
            <div className="flex justify-end pt-3">
              <div className="flex w-[min(100%,20rem)] flex-col">
                <Row k="Subtotal" v={formatAmount(t.subtotal, invoice.currency)} />
                {t.discount > 0 && <Row k="Discount" v={`− ${formatAmount(t.discount, invoice.currency)}`} />}
                <Row k={`Tax (${invoice.taxPercent}%)`} v={formatAmount(t.tax, invoice.currency)} />
                {paidOrPartial && <Row k="Received" v={`− ${formatAmount(t.paid, invoice.currency)}`} />}
                <div className="mt-2 flex flex-col gap-1 border-t border-rule pt-3">
                  <span className="t-eyebrow">{st === "paid" ? "Balance due" : paidOrPartial ? "Balance due" : "Total due"}</span>
                  <Money size="lg" currency={invoice.currency} amount={st === "paid" ? 0 : paidOrPartial ? t.balance : t.total} estimateIn={st === "paid" ? undefined : estimateIn} note />
                </div>
              </div>
            </div>
          </div>
          {invoice.note && <p className="whitespace-pre-line rounded-lg bg-hover px-4 py-3 text-sm text-muted-foreground">{invoice.note}</p>}
        </>
      )}

      {showPay && (
        <section aria-label="Payment instructions" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <h2 className="t-h3">How to pay</h2>
            <p className="text-sm text-muted-foreground">{NO_PROCESSING}</p>
          </div>
          {methods.length === 0 && <p className="text-sm text-muted-foreground">No payment methods selected yet.</p>}
          {methods.map((m, i) => (
            <div key={m.id} className="flex flex-col border-t border-rule pt-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{methodTitle(m)}</span>
                {i === 0 && methods.length > 1 && <Tag>Preferred</Tag>}
              </div>
              {fieldsFor(m.kind, m.scheme).map((f) => {
                const v = m.fields[f.key];
                if (!v) return null;
                return (
                  <div key={f.key} className="grid grid-cols-[minmax(4.5rem,7rem)_minmax(0,1fr)] gap-3 py-1">
                    <span className="pt-[0.15rem] text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{f.label}</span>
                    <span className="num break-words font-semibold">{f.sensitive && !reveal ? maskValue(v) : v}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      )}

      {part === "full" && (
        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          {business.footerNote} Please use the invoice number as the payment reference.{!reveal && " Account details are shown in full to the client on the share link; they are masked here."}
        </p>
      )}
    </article>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="num flex justify-between gap-4 py-2"><span className="text-muted-foreground">{k}</span><span>{v}</span></div>
  );
}
