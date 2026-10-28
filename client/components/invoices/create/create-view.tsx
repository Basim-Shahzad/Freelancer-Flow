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
import { toInvoiceCreate } from "@/lib/api/mappers/invoices";
import { todayISO } from "@/lib/dates";
import { useClientOptions } from "@/lib/hooks/clients";
import { useCreateInvoice, useInvoiceOptions } from "@/lib/hooks/invoices";
import { useMilestones } from "@/lib/hooks/milestones";
import { useIsOnline } from "@/lib/hooks/use-online";
import { usePaymentMethods } from "@/lib/hooks/payment-methods";
import { useBusiness } from "@/lib/hooks/profile";
import { useProjectOptions, useRetainerPeriods } from "@/lib/hooks/projects";
import { useAllTimeEntries } from "@/lib/hooks/time-entries";
import type { InvoiceDetail, PaymentMethod, Project, ProjectWithSchedule } from "@/lib/types";
import {
  STEPS, buildPayload, buildPreview, createFailure, defaultMethodIds, initialSelection, itemsForProject, newManualRow, projectNote,
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
const NO_TIME: string[] = [];

interface Props { projectId?: string; period?: string }

export function InvoiceCreateView(props: Props) {
  // The flow seeds its state from the payment methods, projects and existing invoices, so wait for them
  // (a later refetch error must not unmount it).
  const methodsQuery = usePaymentMethods();
  const projectOptions = useProjectOptions();
  const invoiceOptions = useInvoiceOptions();
  if (projectOptions.isLoading || invoiceOptions.isLoading) return <PageSkeleton rows={4} />;
  if (projectOptions.isError || invoiceOptions.isError) return <Page><StateBlock kind="error" body="Couldn’t load your projects and invoices." /></Page>;
  if (!methodsQuery.data) {
    return <QueryBoundary query={methodsQuery} isEmpty={() => false} loading={<PageSkeleton rows={4} />}>{() => null}</QueryBoundary>;
  }
  return <CreateFlow {...props} methods={methodsQuery.data} projects={projectOptions.projects} invoices={invoiceOptions.invoices} />;
}

function CreateFlow({ projectId, period, methods, projects, invoices }: Props & { methods: PaymentMethod[]; projects: Project[]; invoices: InvoiceDetail[] }) {
  const router = useRouter();
  const { clients } = useClientOptions();
  const business = useBusiness();
  const online = useIsOnline();
  const create = useCreateInvoice();

  const issueDate = todayISO();
  const enabledMethods = useMemo(() => methods.filter((m) => m.enabled), [methods]);

  const [state, setState] = useState<FlowState>(() => {
    const p = projects.find((x) => x.id === projectId);
    const c = clients.find((x) => x.id === p?.clientId);
    // The selection is seeded below, once the project's time / milestones / retainer periods have loaded.
    return {
      projectId: p?.id ?? "", selected: [], manual: [newManualRow()], taxMode: "default", taxName: "", taxRate: "0", discount: "0",
      termsDays: c?.termsDays ?? business.defaultTermsDays, methodIds: null, notes: "", paymentInstructions: "",
    };
  });
  const [step, setStep] = useState(() => (projects.some((p) => p.id === projectId) ? 2 : 1));
  const [error, setError] = useState<string | null>(null);

  const project = projects.find((p) => p.id === state.projectId);
  const client = clients.find((c) => c.id === project?.clientId);

  // Only the chosen project's time / milestones / retainer periods are fetched; the others are summarised without them.
  const timeIds = useMemo(() => (project?.billingType === "hourly" ? [project.id] : NO_TIME), [project]);
  const timeQuery = useAllTimeEntries(timeIds);
  const milestonesQuery = useMilestones(project?.id, project?.currency ?? "USD", !!project?.milestonesEnabled);
  const periodsQuery = useRetainerPeriods(project);
  const scheduleLoading = !!project && (
    (project.billingType === "hourly" && timeQuery.isPending) || (project.milestonesEnabled && milestonesQuery.isPending) ||
    (project.billingType === "retainer" && periodsQuery.isPending)
  );
  const scheduleFailed = !!project && (
    (project.billingType === "hourly" && timeQuery.isError) || (project.milestonesEnabled && milestonesQuery.isError) ||
    (project.billingType === "retainer" && periodsQuery.isError)
  );
  const scheduled = useMemo<ProjectWithSchedule | undefined>(
    () => (project ? { ...project, milestones: milestonesQuery.data ?? [], retainerPeriods: periodsQuery.data ?? [] } : undefined),
    [project, milestonesQuery.data, periodsQuery.data],
  );
  const items = useMemo(() => (scheduled ? itemsForProject(scheduled, timeQuery.data ?? [], invoices) : []), [scheduled, timeQuery.data, invoices]);

  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!scheduled || scheduleLoading || seededFor.current === scheduled.id) return;
    seededFor.current = scheduled.id;
    setState((s) => ({ ...s, selected: initialSelection(items, period, scheduled) }));
  }, [scheduled, scheduleLoading, items, period]);

  const methodIds = useMemo(() => state.methodIds ?? defaultMethodIds(enabledMethods), [state.methodIds, enabledMethods]);
  const chosenMethods = useMemo(() => enabledMethods.filter((m) => methodIds.includes(m.id)), [enabledMethods, methodIds]);

  const choices = useMemo(
    () => projects.filter((p) => isOpenProject(p) || p.id === state.projectId).map((p) => ({
      project: p,
      client: clients.find((c) => c.id === p.clientId),
      // Time, milestones and retainer periods load per project, so only a fixed price can be summarised before choosing.
      note: p.billingType === "fixed" && !p.milestonesEnabled ? projectNote(p, itemsForProject(withoutSchedule(p), [], invoices)) : "choose it to see what is ready",
    })),
    [projects, clients, invoices, state.projectId],
  );

  const preview = useMemo(() => buildPreview(state, project, items, issueDate, business.defaultCurrency), [state, project, items, issueDate, business.defaultCurrency]);

  const ctxFor = (s: FlowState) => ({ state: s, project: client ? project : undefined, items });
  const patch = (p: Partial<FlowState>) => { setState((s) => ({ ...s, ...p })); setError(null); };

  const chooseProject = (id: string) => {
    const p = projects.find((x) => x.id === id);
    const c = clients.find((x) => x.id === p?.clientId);
    seededFor.current = null; // the effect above picks the new project's ready items once its schedule is in
    setState((s) => ({ ...s, projectId: id, selected: [], termsDays: c?.termsDays ?? s.termsDays, methodIds: null }));
    setError(null);
  };
  const toggleItem = (id: string) => {
    const kind = items.find((i) => i.id === id)?.kind;
    // One retainer period per invoice: choosing another one replaces it.
    const others = kind === "retainer" ? state.selected.filter((x) => items.find((i) => i.id === x)?.kind !== "retainer") : state.selected;
    patch({ selected: state.selected.includes(id) ? state.selected.filter((x) => x !== id) : [...others, id] });
  };
  const toggleMethod = (id: string) => patch({ methodIds: methodIds.includes(id) ? methodIds.filter((x) => x !== id) : [...methodIds, id] });

  const goTo = (n: number) => {
    if (n <= step) { setStep(n); setError(null); return; }
    for (let s = step; s < n; s++) {
      const e = validateStep(s, ctxFor(state));
      if (e) { setStep(s); setError(e); return; }
    }
    setStep(n);
    setError(null);
  };

  const submit = async () => {
    if (!project || !client || create.isPending) return;
    for (let s = 1; s <= 4; s++) {
      const e = validateStep(s, ctxFor(state));
      if (e) { setStep(s); setError(e); return; }
    }
    try {
      const inv = await create.mutateAsync(toInvoiceCreate(buildPayload(state, project, items, issueDate)));
      toast.success(`Draft ${inv.number} created`, { description: "It hasn’t been sent yet. Review and send it from the invoice page." });
      router.push(`/invoices/${inv.id}`);
    } catch (e) {
      const failure = createFailure(e);
      if (failure.conflict) { void periodsQuery.refetch(); void milestonesQuery.refetch(); void timeQuery.refetch(); }
      setStep(failure.step);
      setError(failure.message);
    }
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
          <b>You’re offline.</b> Invoices are created on the server, so you can fill this in but can’t create the invoice until you’re back online.
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
              Couldn’t load this project’s time, milestones or retainer periods, so what is ready to invoice may be incomplete.{" "}
              <button type="button" className="font-medium underline underline-offset-[3px]" onClick={() => { void timeQuery.refetch(); void milestonesQuery.refetch(); void periodsQuery.refetch(); }}>Try again</button>
            </Notice>
          )}
          {step === 2 && project && !scheduleLoading && (
            <>
              <StepItems project={project} items={items} selected={state.selected} manual={state.manual} error={error} onToggle={toggleItem} onManual={(manual) => patch({ manual })} />
              {error && <p role="alert" className="flex items-center gap-1 text-sm text-error-ink">{error}</p>}
            </>
          )}
          {step === 3 && project && (
            <StepTax
              taxMode={state.taxMode} taxName={state.taxName} taxRate={state.taxRate} discount={state.discount} notes={state.notes} paymentInstructions={state.paymentInstructions}
              termsDays={state.termsDays} clientTerms={client?.termsDays ?? 14} issueDate={issueDate} error={error}
              onChange={patch} onTerms={(termsDays) => patch({ termsDays })}
            />
          )}
          {step === 4 && <StepMethods methods={enabledMethods} selected={methodIds} usingDefaults={state.methodIds === null} error={error} onToggle={toggleMethod} />}
          {step === 5 && (
            <>
              <StepReview invoice={preview} client={client} project={project} business={business} methods={chosenMethods} termsDays={state.termsDays} />
              {error && <p role="alert" className="text-sm text-error-ink">{error}</p>}
            </>
          )}

          <div className="flex flex-wrap gap-2 border-t border-rule pt-4">
            {step > 1 && <Button variant="outline" onClick={() => goTo(step - 1)}>Back</Button>}
            {step < 5 && <Button onClick={() => goTo(step + 1)}>Continue</Button>}
            {step === 5 && <Button onClick={() => void submit()} disabled={!online || create.isPending}>{create.isPending ? "Creating…" : "Create invoice"}</Button>}
          </div>
        </div>
        <Summary invoice={preview} client={client} project={project} defaultTaxes={state.taxMode === "default"} />
      </Split>
    </Page>
  );
}
