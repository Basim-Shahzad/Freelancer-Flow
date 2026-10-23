"use client";

import { StateBlock } from "@/components/domain/state-block";
import { Page, PageHeader } from "@/components/ui/section";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useClient } from "@/lib/hooks/clients";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";
import { useAppStore } from "@/lib/store";
import type { Client } from "@/lib/types";
import { ClientForm } from "./client-form";

/** New client (no id) or edit client (id). */
export function ClientFormView({ id }: { id?: string }) {
  const online = useAppStore((s) => s.online);
  const query = useClient(id);
  if (!id) return <FormPage />;

  if (query.isPending) {
    if (!online) return <Page width="narrow"><StateBlock kind="offline" cta={{ label: "Try again", onClick: () => void query.refetch() }} /></Page>;
    return <PageSkeleton rows={3} />;
  }
  if (query.isError) {
    if (getApiErrorStatus(query.error) === 404) {
      return (
        <Page width="narrow">
          <StateBlock kind="empty" title="Client not found" body="This client may have been deleted, or the link is wrong." cta={{ label: "Back to clients", href: "/clients" }} />
        </Page>
      );
    }
    const retry = { label: query.isFetching ? "Retrying…" : "Try again", onClick: () => void query.refetch() };
    return <Page width="narrow">{online ? <StateBlock kind="error" body={getApiErrorMessage(query.error)} cta={retry} /> : <StateBlock kind="offline" cta={retry} />}</Page>;
  }
  return <FormPage client={query.data} />;
}

function FormPage({ client }: { client?: Client }) {
  const label = client ? client.companyName || client.name : "";
  return (
    <Page width="narrow">
      <PageHeader
        back={{ href: client ? `/clients/${client.id}` : "/clients", label: client ? label : "Clients" }}
        eyebrow={client ? "Edit client" : "New client"}
        title={client ? label : "Add a client"}
      />
      <ClientForm client={client} />
    </Page>
  );
}
