"use client";

import { StateBlock } from "@/components/domain/state-block";
import { Page, PageHeader } from "@/components/ui/section";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useClientOptions } from "@/lib/hooks/clients";
import { useProject } from "@/lib/hooks/projects";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";
import { useAppStore } from "@/lib/store";
import { ProjectForm } from "./project-form";

/** New project (optionally pre-filled with ?clientId=) or edit project (id). */
export function ProjectFormView({ id, clientId }: { id?: string; clientId?: string }) {
  const online = useAppStore((s) => s.online);
  const query = useProject(id);
  const { clients, isLoading: clientsLoading, isError: clientsError } = useClientOptions();

  if (id) {
    if (query.isPending) {
      if (!online) return <Page width="narrow"><StateBlock kind="offline" cta={{ label: "Try again", onClick: () => void query.refetch() }} /></Page>;
      return <PageSkeleton rows={3} />;
    }
    if (query.isError) {
      if (getApiErrorStatus(query.error) === 404) {
        return (
          <Page width="narrow">
            <StateBlock kind="empty" title="Project not found" body="This project may have been deleted, or the link is wrong." cta={{ label: "Back to projects", href: "/projects" }} />
          </Page>
        );
      }
      const retry = { label: query.isFetching ? "Retrying…" : "Try again", onClick: () => void query.refetch() };
      return <Page width="narrow">{online ? <StateBlock kind="error" body={getApiErrorMessage(query.error)} cta={retry} /> : <StateBlock kind="offline" cta={retry} />}</Page>;
    }
  }
  if (clientsLoading) return <PageSkeleton rows={3} />;

  const project = id ? query.data : undefined;
  if (!project && clientsError) {
    return <Page width="narrow"><StateBlock kind={online ? "error" : "offline"} body="Couldn’t load your clients, which a project needs." /></Page>;
  }
  if (!project && clients.length === 0) {
    return (
      <Page width="narrow">
        <PageHeader back={{ href: "/projects", label: "Projects" }} eyebrow="New project" title="Create a project" />
        <StateBlock kind="empty" title="Add a client first" body="A project belongs to a client. Add one, then come back to set up how you bill." cta={{ label: "Add client", href: "/clients/new" }} />
      </Page>
    );
  }
  return (
    <Page width="narrow">
      <PageHeader
        back={{ href: project ? `/projects/${project.id}` : "/projects", label: project ? project.name : "Projects" }}
        eyebrow={project ? "Edit project" : "New project"}
        title={project ? project.name : "Create a project"}
      />
      <ProjectForm project={project} clientId={clientId} />
    </Page>
  );
}
