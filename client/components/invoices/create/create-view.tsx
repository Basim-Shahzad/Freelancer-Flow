"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { QueryBoundary } from "@/components/domain/query-boundary";
import { StateBlock } from "@/components/domain/state-block";
import { isOpenProject, withoutSchedule } from "@/components/projects/logic";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Page, PageHeader, Split } from "@/components/ui/section";
import { PageSkeleton } from "@/components/ui/skeleton";
import { todayISO } from "@/lib/dates";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { formatInvoiceNumber } from "@/lib/invoice";
import { useClientOptions } from "@/lib/hooks/clients";
import { useMilestones } from "@/lib/hooks/milestones";
import { usePaymentMethods } from "@/lib/hooks/payment-methods";
import { useProjectOptions, useRetainerPeriods } from "@/lib/hooks/projects";
import { useAppStore } from "@/lib/store";
import type { PaymentMethod, Project, ProjectWithSchedule } from "@/lib/types";
import {
  STEPS, buildInput, buildTransientInvoice, defaultMethodIds, initialSelection, itemsForProject, newManualRow, projectNote,
  validateStep, type FlowState,
} from "./logic";
import { StepBar } from "./step-bar";
import { StepItems } from "./step-items";
import { StepMethods } from "./step-methods";
import { StepProject } from "./step-project";
import { StepReview } from "./step-review";
import { StepTax } from "./step-tax";
import { Summary } from "./summary";
import { useBusiness } from "@/lib/hooks/profile";

const MINS_LEFT = [4, 3, 2, 1, 1];

interface Props { projectId?: string; period?: string }

export function InvoiceCreateView(props: Props) {
  const hydrated = useHydrated();
  // The flow seeds its state from the payment methods and the projects, so wait for them (a later refetch error must not unmount it).
  const methodsQuery = usePaymentMethods();
  const projectOptions = useProjectOptions();
  if (!hydrated || projectOptions.isLoading) return <PageSkeleton rows={4} />;
  if (projectOptions.isError) return <Page><StateBlock kind="error" body="Couldn’t load your projects." /></Page>;
  if (!methodsQuery.data) {
    return <QueryBoundary query={methodsQuery} isEmpty={() => false} loading={<PageSkeleton rows={4} />}>{() => null}</QueryBoundary>;
  }
  return <CreateFlow {...props} methods={methodsQuery.data} projects={projectOptions.projects} />;
}

function CreateFlow({ projectId, period, methods, projects }: Props & { methods: PaymentMethod[]; projects: Project[] }) {
  const router = useRouter();
  const { clients } = useClientOptions();
  const time = useAppStore((s) => s.time);
  const invoices = useAppStore((s) => s.invoices);
  const business = useBusiness();
  const online = useAppStore((s) => s.online);
  const createInvoice = useAppStore((s) => s.createInvoice);

  const issueDate = todayISO();
  const enabledMethods = useMemo(() => methods.filter((m) => m.enabled), [methods]);

  const [state, setState] = useState<FlowState>(() => {
    const p = projects.find((x) => x.id === projectId);
    const c = clients.find((x) => x.id === p?.clientId);
    // The selection is seeded below, once the project's milestones / retainer periods have loaded.
    return {
      projectId: p?.id ?? "", selected: [], manual: [newManualRow()], tax: "0", discount: "0",
      termsDays: c?.termsDays ?? business.defaultTermsDays, methodIds: defaultMethodIds(methods),
    };
  });
  const [step, setStep] = useState(() => (projects.some((p) => p.id === projectId) ? 2 : 1));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const project = projects.find((p) => p.id === state.projectId);
  const client = clients.find((c) => c.id === project?.clientId);

  // Only the chosen project's milestones / retainer periods are fetched; the others are summarised without them.
  const milestonesQuery = useMilestones(project?.id, project?.currency ?? "USD", !!project?.milestonesEnabled);
  const periodsQuery = useRetainerPeriods(project);
  const scheduleLoading = !!project && ((project.milestonesEnabled && milestonesQuery.isPending) || (project.billingType === "retainer" && periodsQuery.isPending));
  const scheduleFailed = !!project && ((project.milestonesEnabled && milestonesQuery.isError) || (project.billingType === "retainer" && periodsQuery.isError));
  const scheduled = useMemo<ProjectWithSchedule | undefined>(
    () => (project ? { ...project, milestones: milestonesQuery.data ?? [], retainerPeriods: periodsQuery.data ?? [] } : undefined),
    [project, milestonesQuery.data, periodsQuery.data],
  );
  const items = useMemo(() => (scheduled ? itemsForProject(scheduled, time, invoices) : []), [scheduled, time, invoices]);

  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!scheduled || scheduleLoading || seededFor.current === scheduled.id) return;
    seededFor.current = scheduled.id;
    setState((s) => ({ ...s, selected: initialSelection(items, period, scheduled) }));
  }, [scheduled, scheduleLoading, items, period]);
  const orderedMethodIds = useMemo(() => enabledMethods.filter((m) => state.methodIds.includes(m.id)).map((m) => m.id), [enabledMethods, state.methodIds]);
  const chosenMethods = useMemo(() => enabledMethods.filter((m) => orderedMethodIds.includes(m.id)), [enabledMethods, orderedMethodIds]);
  const number = formatInvoiceNumber(business.invoicePrefix, business.nextInvoiceNumber);

  const choices = useMemo(
    () => projects.filter((p) => isOpenProject(p) || p.id === state.projectId).map((p) => ({
      project: p,
      client: clients.find((c) => c.id === p.clientId),
      // Milestones and retainer periods load per project, so those are only summarised once the project is chosen.
      note: p.milestonesEnabled || p.billingType === "retainer" ? "choose it to see what is ready" : projectNote(p, itemsForProject(withoutSchedule(p), time, invoices)),
    })),
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
    seededFor.current = null; // the effect above picks the new project's ready items once its schedule is in
    setState((s) => ({ ...s, projectId: id, selected: [], termsDays: c?.termsDays ?? s.termsDays, methodIds: defaultMethodIds(methods) }));
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
          {step === 2 && project && scheduleLoading && <div role="status" aria-label="Loading what is ready to invoice"><PageSkeleton rows={2} /></div>}
          {step === 2 && project && scheduleFailed && (
            <Notice tone="error" role="alert">
              Couldn’t load this project’s milestones or retainer periods, so what is ready to invoice may be incomplete.{" "}
              <button type="button" className="font-medium underline underline-offset-[3px]" onClick={() => { void milestonesQuery.refetch(); void periodsQuery.refetch(); }}>Try again</button>
            </Notice>
          )}
          {step === 2 && project && !scheduleLoading && (
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
