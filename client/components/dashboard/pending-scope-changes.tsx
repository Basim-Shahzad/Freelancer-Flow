"use client";

import { Money } from "@/components/domain/money";
import { LCell, LedgerRow, LMain, LSub } from "@/components/ui/ledger";
import { Card, CardBody, CardHead } from "@/components/ui/section";
import { fmtDate } from "@/lib/dates";
import { useChangeRequests } from "@/lib/hooks/change-requests";
import { useProjectOptions } from "@/lib/hooks/projects";
import { useBusiness } from "@/lib/hooks/profile";
import { getApiErrorMessage } from "@/lib/services/api.service";
import { useAppStore } from "@/lib/store";

const COLS = "minmax(0,1.4fr) minmax(0,1fr) auto";

/**
 * Scope changes still awaiting a decision, across projects. Hidden while there are none (or while loading);
 * a failure shows a small notice and never blocks the rest of the dashboard.
 */
export function PendingScopeChanges() {
  const online = useAppStore((s) => s.online);
  const { byId } = useProjectOptions();
  const fallback = useBusiness().defaultCurrency;
  const query = useChangeRequests({ status: "PENDING", limit: 100 }, (projectId) => byId.get(projectId)?.currency ?? fallback);

  if (query.isError) {
    return (
      <Card>
        <CardHead title="Scope changes awaiting a decision" />
        <CardBody>
          <p role="alert" className="text-sm text-muted-foreground">
            {online ? getApiErrorMessage(query.error) : "You’re offline. Scope changes will load when you reconnect."}
          </p>
        </CardBody>
      </Card>
    );
  }
  const rows = query.data?.changeRequests ?? [];
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHead title="Scope changes awaiting a decision" sub="Extra work you logged and haven’t settled with the client" />
      <CardBody className="py-1">
        {rows.map((c) => {
          const project = byId.get(c.projectId);
          return (
            <LedgerRow key={c.id} cols={COLS} href={`/projects/${c.projectId}`}>
              <LCell><LMain>{c.title}</LMain><LSub>{project?.name ?? "Project"}</LSub></LCell>
              <LCell narrow="hide"><LSub className="text-sm">Requested {fmtDate(c.requestedAt.slice(0, 10))}</LSub></LCell>
              <LCell end>
                {c.estimatedAmount !== undefined
                  ? <Money amount={c.estimatedAmount} currency={project?.currency ?? fallback} size="sm" align="end" />
                  : <LSub>Unpriced</LSub>}
              </LCell>
            </LedgerRow>
          );
        })}
      </CardBody>
    </Card>
  );
}
