"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Page, PageHeader, Split } from "@/components/ui/section";
import { PageSkeleton } from "@/components/ui/skeleton";
import { todayISO } from "@/lib/dates";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { formatInvoiceNumber } from "@/lib/invoice";
import { useAppStore } from "@/lib/store";
import {
  STEPS, buildInput, buildTransientInvoice, defaultMethodIds, initialSelection, itemsForProject, newManualRow, projectNote, readyIds,
  validateStep, type FlowState,
} from "./logic";
import { StepBar } from "./step-bar";
import { StepItems } from "./step-items";
import { StepMethods } from "./step-methods";
import { StepProject } from "./step-project";
import { StepReview } from "./step-review";
import { StepTax } from "./step-tax";
import { Summary } from "./summary";

const MINS_LEFT = [4, 3, 2, 1, 1];

interface Props { projectId?: string; period?: string }

export function InvoiceCreateView(props: Props) {
  const hydrated = useHydrated();
  if (!hydrated) return <PageSkeleton rows={4} />;
  return <CreateFlow {...props} />;
}

function CreateFlow({ projectId, period }: Props) {
  const router = useRouter();
  const projects = useAppStore((s) => s.projects);
  const clients = useAppStore((s) => s.clients);
  const time = useAppStore((s) => s.time);
  const invoices = useAppStore((s) => s.invoices);
  const methods = useAppStore((s) => s.methods);
  const business = useAppStore((s) => s.business);
  const online = useAppStore((s) => s.online);
  const createInvoice = useAppStore((s) => s.createInvoice);

  const issueDate = todayISO();
  const enabledMethods = useMemo(() => methods.filter((m) => m.enabled), [methods]);

  const [state, setState] = useState<FlowState>(() => {
    const p = projects.find((x) => x.id === projectId);
    const c = clients.find((x) => x.id === p?.clientId);
    const items = p ? itemsForProject(p, time, invoices) : [];
    return {
      projectId: p?.id ?? "", selected: initialSelection(items, period, p), manual: [newManualRow()], tax: "0", discount: "0",
      termsDays: c?.termsDays ?? business.defaultTermsDays, methodIds: defaultMethodIds(methods, c),
    };
  });
  const [step, setStep] = useState(() => (projects.some((p) => p.id === projectId) ? 2 : 1));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const project = projects.find((p) => p.id === state.projectId);
  const client = clients.find((c) => c.id === project?.clientId);
  const items = useMemo(() => (project ? itemsForProject(project, time, invoices) : []), [project, time, invoices]);
  const orderedMethodIds = useMemo(() => enabledMethods.filter((m) => state.methodIds.includes(m.id)).map((m) => m.id), [enabledMethods, state.methodIds]);
  const chosenMethods = useMemo(() => enabledMethods.filter((m) => orderedMethodIds.includes(m.id)), [enabledMethods, orderedMethodIds]);
  const number = formatInvoiceNumber(business.invoicePrefix, business.nextInvoiceNumber);

  const choices = useMemo(
    () => projects.filter((p) => p.status !== "completed" || p.id === state.projectId).map((p) => ({ project: p, client: clients.find((c) => c.id === p.clientId), note: projectNote(p, itemsForProject(p, time, invoices)) })),
    [projects, clients, time, invoices, state.projectId],
  );

  const preview = useMemo(() => {
    if (project && client) return buildTransientInvoice(buildInput({ ...state, methodIds: orderedMethodIds }, project, client, items, true), number, issueDate);
    return buildTransientInvoice({ clientId: "", currency: business.defaultCurrency, dueDate: issueDate, lines: [], taxPercent: 0, discount: 0, paymentMethodIds: [] }, number, issueDate);
  }, [project, client, state, orderedMethodIds, items, number, issueDate, business.defaultCurrency]);

  const ctxFor = (s: FlowState) => ({ state: s, project: client ? project : undefined, items, enabledMethodCount: enabledMethods.length });
  const patch = (p: Partial<FlowState>) => { setState((s) => ({ ...s, ...p })); setError(null); };

  const chooseProject = (id: string) => {
    const p = projects.find((x) => x.id === id);
    const c = clients.find((x) => x.id === p?.clientId);
    const its = p ? itemsForProject(p, time, invoices) : [];
    setState((s) => ({ ...s, projectId: id, selected: readyIds(its), termsDays: c?.termsDays ?? s.termsDays, methodIds: defaultMethodIds(methods, c) }));
    setError(null);
  };
  const toggle = (key: "selected" | "methodIds", id: string) => patch({ [key]: state[key].includes(id) ? state[key].filter((x) => x !== id) : [...state[key], id] });

  const goTo = (n: number) => {
    if (n <= step) { setStep(n); setError(null); return; }
    for (let s = step; s < n; s++) {
      const e = validateStep(s, ctxFor(state));
      if (e) { setStep(s); setError(e); return; }
    }
    setStep(n);
    setError(null);
  };

  const submit = (asDraft: boolean) => {
    if (!project || !client || submitting) return;
    for (let s = 1; s <= 4; s++) {
      const e = validateStep(s, ctxFor(state));
      if (e) { setStep(s); setError(e); return; }
    }
    setSubmitting(true);
    const inv = createInvoice(buildInput({ ...state, methodIds: orderedMethodIds }, project, client, items, asDraft));
    toast.success(asDraft ? `Draft ${inv.number} saved` : `Invoice ${inv.number} created`, { description: asDraft ? undefined : "It hasn’t been sent yet. Send it from the invoice page." });
    router.push(`/invoices/${inv.id}`);
  };

  return (
    <Page>
      <PageHeader
        back={{ href: "/invoices", label: "Invoices" }}
        title="Create invoice"
        actions={<span className="text-sm text-muted-foreground" aria-live="polite">Step {step} of {STEPS.length} · about {MINS_LEFT[step - 1]} min left</span>}
      />
      <StepBar step={step} onGo={goTo} />

      {!online && (
        <Notice tone="warn" role="status">
          <b>You’re offline.</b> You can finish and save this as a draft on this device. Numbering and sending happen once you’re back online.
        </Notice>
      )}

      <Split>
        <div className="flex min-w-0 flex-col gap-6">
          {step === 1 && (
            <>
              <StepProject choices={choices} value={state.projectId} onChange={chooseProject} />
              {error && <p role="alert" className="text-sm text-error-ink">{error}</p>}
            </>
          )}
          {step === 2 && project && (
            <>
              <StepItems project={project} items={items} selected={state.selected} manual={state.manual} error={error} onToggle={(id) => toggle("selected", id)} onManual={(manual) => patch({ manual })} />
              {error && <p role="alert" className="flex items-center gap-1 text-sm text-error-ink">{error}</p>}
            </>
          )}
          {step === 3 && project && (
            <StepTax
              currency={project.currency} tax={state.tax} discount={state.discount} termsDays={state.termsDays} clientTerms={client?.termsDays ?? 14} issueDate={issueDate} error={error}
              onTax={(tax) => patch({ tax })} onDiscount={(discount) => patch({ discount })} onTerms={(termsDays) => patch({ termsDays })}
            />
          )}
          {step === 4 && <StepMethods methods={enabledMethods} selected={state.methodIds} error={error} onToggle={(id) => toggle("methodIds", id)} />}
          {step === 5 && <StepReview invoice={preview} client={client} project={project} business={business} methods={chosenMethods} termsDays={state.termsDays} />}

          <div className="flex flex-wrap gap-2 border-t border-rule pt-4">
            {step > 1 && <Button variant="outline" onClick={() => goTo(step - 1)}>Back</Button>}
            {step < 5 && <Button onClick={() => goTo(step + 1)}>Continue</Button>}
            {step === 5 && (
              <>
                <Button onClick={() => submit(false)} disabled={!online || submitting}>Create invoice</Button>
                <Button variant="ghost" onClick={() => submit(true)} disabled={submitting}>Save as draft</Button>
              </>
            )}
          </div>
        </div>
        <Summary invoice={preview} client={client} project={project} />
      </Split>
    </Page>
  );
}
