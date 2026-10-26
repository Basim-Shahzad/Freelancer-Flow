import Link from "next/link";
import { Tag } from "@/components/ui/tag";
import { Card, CardBody, CardHead } from "@/components/ui/section";
import type { Client } from "@/lib/types";
import { ClientDot } from "./client-dot";

const linkCls = "inline-flex min-h-11 items-center text-sm font-medium text-primary-ink underline decoration-1 underline-offset-[3px]";

/** The project's client. `client` is undefined while it loads or when it cannot be read; `name` is the nested client name. */
export function ProjectClientCard({ client, fallbackName, clientId, clientIds }: { client?: Client; fallbackName: string; clientId: string; clientIds: readonly string[] }) {
  return (
    <Card>
      <CardHead title="Client" />
      <CardBody className="flex flex-col gap-3">
        <div>
          <p className="m-0 inline-flex items-center gap-2 font-semibold"><ClientDot clientId={clientId} clientIds={clientIds} />{client?.companyName || client?.name || fallbackName}</p>
          {client && <p className="m-0 mt-0.5 text-sm text-muted-foreground">{[client.companyName ? client.name : "", client.email].filter(Boolean).join(" · ")}</p>}
        </div>
        {client && <div className="flex flex-wrap gap-1.5"><Tag>{client.currency}</Tag><Tag>{client.termsDays === 0 ? "Due on receipt" : `Net ${client.termsDays}`}</Tag></div>}
        <div><Link href={`/clients/${clientId}`} className={linkCls}>Open client</Link></div>
      </CardBody>
    </Card>
  );
}
