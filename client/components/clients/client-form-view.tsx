"use client";

import { StateBlock } from "@/components/domain/state-block";
import { Page, PageHeader } from "@/components/ui/section";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAppStore } from "@/lib/store";
import { ClientForm } from "./client-form";

/** New client (no id) or edit client (id). */
export function ClientFormView({ id }: { id?: string }) {
  const hydrated = useHydrated();
  const client = useAppStore((s) => s.clients.find((c) => c.id === id));
  if (!hydrated) return <PageSkeleton rows={3} />;
  if (id && !client) {
    return (
      <Page width="narrow">
        <StateBlock kind="empty" title="Client not found" body="This client may have been deleted, or the link is wrong." cta={{ label: "Back to clients", href: "/clients" }} />
      </Page>
    );
  }
  return (
    <Page width="narrow">
      <PageHeader
        back={{ href: client ? `/clients/${client.id}` : "/clients", label: client ? client.name : "Clients" }}
        eyebrow={client ? "Edit client" : "New client"}
        title={client ? client.name : "Add a client"}
      />
      <ClientForm client={client} />
    </Page>
  );
}
