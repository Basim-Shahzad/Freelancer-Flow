"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Plus, Search } from "lucide-react";
import { OfflineNotice } from "@/components/dashboard/offline-notice";
import { StateBlock } from "@/components/domain/state-block";
import { ClientDot } from "@/components/projects/client-dot";
import { Button } from "@/components/ui/button";
import { Input, InputAffix } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LCell, LedgerHead, LedgerRow, LMain, LSub } from "@/components/ui/ledger";
import { Card, CardHead, KpiStrip, Page, PageHeader, Toolbar } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { useClientOptions, useClients } from "@/lib/hooks/clients";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";
import { useAppStore } from "@/lib/store";

const COLS = "minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) minmax(0,.8fr) 1.25rem";

export function ClientsView() {
  const online = useAppStore((s) => s.online);
  const [q, setQ] = useState("");
  const search = useDebouncedValue(q.trim(), 300);
  const query = useClients({ search });
  // Colours are keyed to a client's position in the full list so they stay stable while searching.
  const { clients: everyone } = useClientOptions();
  const clientIds = useMemo(() => everyone.map((c) => c.id), [everyone]);

  const addBtn = <Button asChild><Link href="/clients/new"><Plus aria-hidden="true" />Add client</Link></Button>;
  const { data } = query;

  if (query.isPending) {
    if (!online) return <Shell actions={addBtn}><StateBlock kind="offline" cta={{ label: "Try again", onClick: () => void query.refetch() }} /></Shell>;
    return <Shell actions={addBtn}><div role="status" aria-label="Loading clients" className="flex flex-col gap-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-64 w-full" /></div></Shell>;
  }
  if (query.isError && !data) {
    const status = getApiErrorStatus(query.error);
    const retry = { label: query.isFetching ? "Retrying…" : "Try again", onClick: () => void query.refetch() };
    if (!online) return <Shell actions={addBtn}><StateBlock kind="offline" cta={retry} /></Shell>;
    if (status === 429) return <Shell actions={addBtn}><StateBlock kind="error" title="Too many requests" body="You’re going a little fast. Wait a moment and try again." cta={retry} /></Shell>;
    return <Shell actions={addBtn}><StateBlock kind="error" body={getApiErrorMessage(query.error)} cta={retry} /></Shell>;
  }

  const clients = data?.clients ?? [];
  const total = data?.total ?? 0;
  const searching = search !== "";

  if (total === 0 && !searching && q.trim() === "") {
    // Nothing at all (not just nothing matching a search).
    return (
      <Shell actions={addBtn}>
        <StateBlock kind="empty" title="No clients yet" body="Add the first person or company you work for. Include a WhatsApp number to share invoices and reminders in one tap." cta={{ label: "Add client", href: "/clients/new" }} />
      </Shell>
    );
  }

  return (
    <Page>
      <PageHeader eyebrow={`${total} ${total === 1 ? "client" : "clients"}`} title="Clients" actions={addBtn} />
      <OfflineNotice />
      {!searching && <KpiStrip items={[{ value: String(total), label: total === 1 ? "Client" : "Clients" }]} />}
      <Toolbar>
        <InputAffix className="min-w-0 flex-1 basis-64 @2xl:max-w-sm" prefix={<Search className="size-4" aria-hidden="true" />}>
          <Label className="sr-only" htmlFor="cl-q">Search clients</Label>
          <Input id="cl-q" type="search" placeholder="Search by name, company or email" value={q} onChange={(e) => setQ(e.target.value)} />
        </InputAffix>
      </Toolbar>

      <Card>
        <CardHead title="Your clients" />
        <section aria-label="Client list" aria-busy={query.isFetching} className="px-5">
          <LedgerHead cols={COLS}>
            <span>Client</span><span>Email</span><span>WhatsApp</span><span>Projects</span><span />
          </LedgerHead>
          {clients.map((client) => (
            <LedgerRow key={client.id} cols={COLS} href={`/clients/${client.id}`} className="last:border-b-0">
              <LCell>
                <LMain className="inline-flex items-center gap-2"><ClientDot clientId={client.id} clientIds={clientIds} />{client.companyName || client.name}</LMain>
                <LSub>{client.companyName ? client.name : client.email}</LSub>
              </LCell>
              <LCell narrow="hide"><span className="break-all text-sm text-muted-foreground">{client.email || "—"}</span></LCell>
              <LCell narrow="hide"><span className="num text-sm text-muted-foreground">{client.whatsapp || "—"}</span></LCell>
              <LCell narrow="hide"><span className="num text-sm">{client.projects?.length ?? 0}</span></LCell>
              <LCell narrow="hide"><ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" /></LCell>
            </LedgerRow>
          ))}
          {clients.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground" role="status">No clients match “{q.trim()}”.</p>
          )}
        </section>
        {query.hasNextPage && (
          <div className="flex items-center gap-3 px-5 pb-5">
            <Button variant="outline" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Load more</Button>
            <span className="text-sm text-muted-foreground">Showing {clients.length} of {total}</span>
          </div>
        )}
        {query.isFetchNextPageError && <p role="alert" className="px-5 pb-5 text-sm text-error-ink">{getApiErrorMessage(query.error, "Couldn’t load more clients.")}</p>}
      </Card>
    </Page>
  );
}

function Shell({ actions, children }: { actions: React.ReactNode; children: React.ReactNode }) {
  return (
    <Page>
      <PageHeader eyebrow="Clients" title="Clients" actions={actions} />
      {children}
    </Page>
  );
}
