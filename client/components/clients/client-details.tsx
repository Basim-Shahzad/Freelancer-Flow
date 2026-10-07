import { MessageCircle } from "lucide-react";
import { Card, CardBody, CardHead, KV } from "@/components/ui/section";
import { Tag } from "@/components/ui/tag";
import { METHOD_KINDS } from "@/lib/payment-methods";
import type { Client } from "@/lib/types";
import { termsLabel, waLink } from "./schema";

const linkCls = "inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary-ink underline decoration-1 underline-offset-[3px]";

/** Contact, terms, pays-by tags and notes. */
export function ClientDetails({ client }: { client: Client }) {
  const wa = waLink(client.whatsapp);
  return (
    <Card className="min-w-0">
      <CardHead title="Details" />
      <CardBody className="py-1">
        <KV label="Contact">{client.contactName || "—"}</KV>
        <KV label="Email">{client.email ? <a className={`${linkCls} break-all`} href={`mailto:${client.email}`}>{client.email}</a> : "—"}</KV>
        <KV label="WhatsApp">
          {client.whatsapp ? (
            <div className="flex flex-col items-start gap-1">
              <span className="num">{client.whatsapp}</span>
              {wa && <a className={linkCls} href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" aria-hidden="true" />Open WhatsApp chat<span className="sr-only"> (opens in a new tab)</span></a>}
            </div>
          ) : "—"}
        </KV>
        <KV label="Bills in">{client.currency}</KV>
        <KV label="Terms">{termsLabel(client.termsDays)}</KV>
        <KV label="Pays by">
          {client.prefersMethods.length === 0 ? <span className="text-muted-foreground">No preference set</span> : (
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {client.prefersMethods.map((k) => <li key={k}><Tag>{METHOD_KINDS[k]?.label ?? k}</Tag></li>)}
            </ul>
          )}
        </KV>
        <KV label="Notes"><span className="[text-wrap:pretty]">{client.notes || <span className="text-muted-foreground">No notes</span>}</span></KV>
      </CardBody>
    </Card>
  );
}
