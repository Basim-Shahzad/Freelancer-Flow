"use client";

import { StateBlock } from "@/components/domain/state-block";
import { Page, PageHeader } from "@/components/ui/section";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useClientOptions } from "@/lib/hooks/clients";
import { useAppStore } from "@/lib/store";
import { ProjectForm } from "./project-form";

/** New project (optionally pre-filled with ?clientId=) or edit project (id). */
export function ProjectFormView({ id, clientId }: { id?: string; clientId?: string }) {
  const hydrated = useHydrated();
  const project = useAppStore((s) => s.projects.find((p) => p.id === id));
  const { clients, isLoading: clientsLoading } = useClientOptions();
  const clientCount = clients.length;
  if (!hydrated || clientsLoading) return <PageSkeleton rows={3} />;
  if (id && !project) {
    return (
      <Page width="narrow">
        <StateBlock kind="empty" title="Project not found" body="This project may have been deleted, or the link is wrong." cta={{ label: "Back to projects", href: "/projects" }} />
      </Page>
    );
  }
  if (!project && clientCount === 0) {
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
