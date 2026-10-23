"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { OfflineNotice } from "@/components/dashboard/offline-notice";
import { StateBlock } from "@/components/domain/state-block";
import { ClientDot } from "@/components/projects/client-dot";
import { Button } from "@/components/ui/button";
import { LCell, LedgerRow, LMain, LSub } from "@/components/ui/ledger";
import { Card, CardBody, CardHead, KpiStrip, Page, PageHeader } from "@/components/ui/section";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useApiToast } from "@/lib/hooks/use-api-toast";
import { useClient, useClientOptions, useDeleteClient } from "@/lib/hooks/clients";
import { fmtDate } from "@/lib/dates";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";
import { useAppStore } from "@/lib/store";
import { ClientDetails } from "./client-details";
import { DeleteClientDialog } from "./delete-client-dialog";

const linkCls = "inline-flex min-h-11 items-center text-sm font-medium text-primary-ink underline decoration-1 underline-offset-[3px]";

export function ClientDetailView({ id }: { id: string }) {
  const router = useRouter();
  const toast = useApiToast();
  const online = useAppStore((s) => s.online);
  const query = useClient(id);
  const remove = useDeleteClient();
  const { clients, byId, isLoading: projectsLoading, isError: projectsError } = useClientOptions();
  const clientIds = useMemo(() => clients.map((c) => c.id), [clients]);
  // Only list items embed projects, so they come from the shared, cached full client list.
  const projects = byId.get(id)?.projects ?? [];

  if (query.isPending) {
    if (!online) return <Page><StateBlock kind="offline" cta={{ label: "Try again", onClick: () => void query.refetch() }} /></Page>;
    return <PageSkeleton rows={3} />;
  }
  if (query.isError) {
    const retry = { label: query.isFetching ? "Retrying…" : "Try again", onClick: () => void query.refetch() };
    if (getApiErrorStatus(query.error) === 404) {
      return <Page><StateBlock kind="empty" title="Client not found" body="This client may have been deleted, or the link is wrong." cta={{ label: "Back to clients", href: "/clients" }} /></Page>;
    }
    if (!online) return <Page><StateBlock kind="offline" cta={retry} /></Page>;
    if (getApiErrorStatus(query.error) === 429) return <Page><StateBlock kind="error" title="Too many requests" body="Wait a moment and try again." cta={retry} /></Page>;
    return <Page><StateBlock kind="error" body={getApiErrorMessage(query.error)} cta={retry} /></Page>;
  }

  const client = query.data;
  const title = client.companyName || client.name;
  const onDelete = async () => {
    await remove.mutateAsync(client.id);
    toast.success(`${title} deleted`);
    router.push("/clients");
  };

  return (
    <Page>
      <PageHeader
        back={{ href: "/clients", label: "Clients" }}
        eyebrow="Client"
        title={<span className="inline-flex items-center gap-3"><ClientDot clientId={client.id} clientIds={clientIds} className="size-3" />{title}</span>}
        meta={client.companyName ? client.name : undefined}
        actions={
          <>
            <Button variant="outline" asChild><Link href={`/clients/${client.id}/edit`}>Edit</Link></Button>
            <Button variant="outline" asChild><Link href={`/projects/new?clientId=${client.id}`}>New project</Link></Button>
            <Button asChild><Link href={`/invoices/new?clientId=${client.id}`}>Create invoice</Link></Button>
          </>
        }
      />
      <OfflineNotice />
      <KpiStrip items={[{ value: projectsLoading || projectsError ? "—" : String(projects.length), label: projects.length === 1 ? "Project" : "Projects" }]} />
      <div className="grid items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHead title="Projects" action={<Link href={`/projects/new?clientId=${client.id}`} className={linkCls}>New project</Link>} />
            {projectsLoading ? (
              <CardBody><p className="m-0 text-sm text-muted-foreground" role="status">Loading projects…</p></CardBody>
            ) : projectsError ? (
              <CardBody><p className="m-0 text-sm text-error-ink" role="alert">Couldn’t load this client’s projects.</p></CardBody>
            ) : projects.length === 0 ? (
              <CardBody><p className="m-0 text-sm text-muted-foreground">No projects for {title} yet.</p></CardBody>
            ) : (
              <div className="px-5">
                {projects.map((p) => (
                  <LedgerRow key={p.id} cols="minmax(0,1fr) 8rem" href={`/projects/${p.id}`} className="last:border-b-0">
                    <LCell><LMain>{p.name}</LMain></LCell>
                    <LCell narrow="hide" end><LSub>Added {fmtDate(p.createdAt.slice(0, 10))}</LSub></LCell>
                  </LedgerRow>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHead title="Invoices" />
            <CardBody>
              <p className="m-0 text-sm text-muted-foreground">
                Invoice history, payments and pay speed for this client arrive with the invoices update. In the meantime, see{" "}
                <Link href="/invoices" className="font-medium text-primary-ink underline underline-offset-[3px]">all invoices</Link>.
              </p>
            </CardBody>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-6" aria-label="Client details">
          <ClientDetails client={client} />
          <div className="flex flex-col gap-2 border-t border-rule pt-4">
            <DeleteClientDialog name={title} onConfirm={onDelete} />
          </div>
        </aside>
      </div>
    </Page>
  );
}
