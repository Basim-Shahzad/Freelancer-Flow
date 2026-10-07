"use client";

import { useMemo, useState } from "react";
import { StageThread } from "@/components/domain/stage-thread";
import { Notice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAppStore } from "@/lib/store";
import { MilestoneList, type Outcome } from "./milestone-list";
import { InvoicesSection, MilestoneProgress, SimpleOverview } from "./project-overview";
import { deriveProjectStage, firstName, milestoneStats, projectCaption, projectInvoices } from "./portal-logic";
import { LinkInactive, PortalSkeleton } from "./portal-states";

export function ProjectPortalView({ token }: { token: string }) {
  const hydrated = useHydrated();
  const project = useAppStore((s) => s.projects.find((p) => p.shareToken === token));
  const invoices = useAppStore((s) => s.invoices);
  const clients = useAppStore((s) => s.clients);
  const ownerName = useAppStore((s) => s.business.ownerName);
  const online = useAppStore((s) => s.online);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome | undefined>>({});

  const visible = useMemo(() => (project ? projectInvoices(project, invoices) : []), [project, invoices]);

  if (!hydrated) return <PortalSkeleton />;
  if (!project) return <LinkInactive what="project" />;

  const owner = firstName(ownerName);
  const client = clients.find((c) => c.id === project.clientId);
  const hasMilestones = project.billingType === "milestone" && project.milestones.length > 0;
  const stage = deriveProjectStage(project, visible);

  return (
    <>
      {!online && (
        <Notice tone="warn"><b>You’re offline.</b> You’re seeing the last loaded version. Approving needs a connection.</Notice>
      )}

      <header className="flex flex-col gap-2.5">
        <span className="t-eyebrow">Project</span>
        <h1 className="t-h1">{project.name}</h1>
        {client && <span className="text-sm text-muted-foreground">{client.name} · prepared for {client.contactName}</span>}
      </header>

      <StageThread stage={stage} caption={projectCaption(project, stage, owner)} />

      {hasMilestones ? (
        <>
          <MilestoneProgress stats={milestoneStats(project.milestones)} currency={project.currency} />
          <Section title="Milestones" id="pp-ms">
            <MilestoneList
              project={project}
              ownerFirst={owner}
              online={online}
              outcomes={outcomes}
              onOutcome={(id, o) => setOutcomes((prev) => ({ ...prev, [id]: o }))}
            />
          </Section>
        </>
      ) : (
        <SimpleOverview project={project} invoices={visible} />
      )}

      <InvoicesSection invoices={visible} ownerFirst={owner} />
    </>
  );
}
