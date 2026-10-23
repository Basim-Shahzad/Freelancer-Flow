import { MessageCircle } from "lucide-react";
import { Card, CardBody, CardHead, KV } from "@/components/ui/section";
import type { Client } from "@/lib/types";
import { termsLabel, waLink } from "./schema";

const linkCls = "inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary-ink underline decoration-1 underline-offset-[3px]";
const none = <span className="text-muted-foreground">—</span>;

/** Contact, billing terms, address, tax id and notes. WhatsApp is shown as the server returned it. */
export function ClientDetails({ client }: { client: Client }) {
  const wa = waLink(client.whatsapp);
  return (
    <Card className="min-w-0">
      <CardHead title="Details" />
      <CardBody className="py-1">
        <KV label="Name">{client.name}</KV>
        <KV label="Company">{client.companyName || none}</KV>
        <KV label="Email">{client.email ? <a className={`${linkCls} break-all`} href={`mailto:${client.email}`}>{client.email}</a> : none}</KV>
        <KV label="Phone">{client.phone ? <span className="num">{client.phone}</span> : none}</KV>
        <KV label="WhatsApp">
          {client.whatsapp ? (
            <div className="flex flex-col items-start gap-1">
              <span className="num">{client.whatsapp}</span>
              {wa && <a className={linkCls} href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" aria-hidden="true" />Open WhatsApp chat<span className="sr-only"> (opens in a new tab)</span></a>}
            </div>
          ) : none}
        </KV>
        <KV label="Address"><span className="whitespace-pre-line [text-wrap:pretty]">{client.address || none}</span></KV>
        <KV label="Tax ID">{client.taxId ? <span className="num">{client.taxId}</span> : none}</KV>
        <KV label="Bills in">{client.currency}</KV>
        <KV label="Terms">{termsLabel(client.termsDays)}</KV>
        <KV label="Notes"><span className="[text-wrap:pretty]">{client.notes || <span className="text-muted-foreground">No notes</span>}</span></KV>
      </CardBody>
    </Card>
  );
}
