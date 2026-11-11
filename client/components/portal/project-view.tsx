"use client";

import { OfflineNotice } from "@/components/dashboard/offline-notice";
import { Section } from "@/components/ui/section";
import { Tag } from "@/components/ui/tag";
import { fmtDate } from "@/lib/dates";
import { usePortalProject } from "@/lib/hooks/portal";
import { usePortalToken } from "@/lib/portal/token";
import { ConvertToUser } from "./convert-dialog";
import { MissingToken, PortalErrorState, PortalSkeleton } from "./portal-states";

const STATUS_LABEL = { draft: "Draft", active: "In progress", paused: "Paused", completed: "Completed", archived: "Archived", cancelled: "Cancelled" } as const;

/** Slim summary: the portal API exposes only name, description, status, due date and currency. */
export function ProjectPortalView({ id }: { id: string }) {
  const token = usePortalToken();
  const query = usePortalProject(id, token);

  if (!token) return <MissingToken what="project" />;
  if (query.isPending) return <PortalSkeleton />;
  if (query.isError) return <PortalErrorState error={query.error} what="project" onRetry={() => void query.refetch()} />;

  const p = query.data;
  return (
    <>
      <OfflineNotice detail="You’re seeing the last loaded version." />
      <header className="flex flex-col gap-2.5">
        <span className="t-eyebrow">Project</span>
        <h1 className="t-h1">{p.name}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Tag>{STATUS_LABEL[p.status]}</Tag>
          {p.dueDate && <span>Due {fmtDate(p.dueDate)}</span>}
          <span>Billed in {p.currency}</span>
        </div>
      </header>
      {p.description && <Section title="About this project" id="pp-about"><p className="m-0 whitespace-pre-line">{p.description}</p></Section>}
      <ConvertToUser token={token} />
    </>
  );
}
