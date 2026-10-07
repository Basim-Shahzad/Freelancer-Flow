import { StatusChip } from "@/components/domain/status-chip";
import { LedgerRow, LMain, LSub } from "@/components/ui/ledger";
import { Progress } from "@/components/ui/progress";
import { KV, Section } from "@/components/ui/section";
import { Tag } from "@/components/ui/tag";
import { fmtDate } from "@/lib/dates";
import { calcTotals, deriveStatus } from "@/lib/invoice";
import { formatMoney } from "@/lib/money";
import type { Invoice, Project } from "@/lib/types";
import type { MilestoneStats } from "./portal-logic";

const BILLING_LABEL = { fixed: "Fixed price", hourly: "Hourly", retainer: "Monthly retainer", milestone: "Milestones" } as const;
const STATUS_LABEL = { active: "In progress", paused: "Paused", completed: "Completed" } as const;

export function MilestoneProgress({ stats, currency }: { stats: MilestoneStats; currency: Project["currency"] }) {
  return (
    <Section title="Progress" id="pp-prog" action={<span className="num text-sm text-muted-foreground">{stats.doneCount} of {stats.count} approved</span>}>
      <div className="flex flex-col gap-2">
        <Progress value={stats.percent} label="Approved share of project value" />
        <span className="t-caption">{stats.percent}% of the project value ({formatMoney(stats.total, currency)} total) is approved.</span>
      </div>
    </Section>
  );
}

/** Overview for fixed / hourly / retainer projects (no milestones). */
export function SimpleOverview({ project, invoices }: { project: Project; invoices: Invoice[] }) {
  const billing =
    project.billingType === "fixed" && project.fixedAmount != null ? `Fixed price · ${formatMoney(project.fixedAmount, project.currency)}`
    : project.billingType === "hourly" && project.hourlyRate != null ? `Hourly · ${formatMoney(project.hourlyRate, project.currency)} per hour`
    : project.billingType === "retainer" && project.retainerAmount != null ? `${formatMoney(project.retainerAmount, project.currency)} per month${project.retainerHours ? ` · ${project.retainerHours} hours` : ""}`
    : BILLING_LABEL[project.billingType];
  const pct = project.status === "completed" ? 100 : project.progress;
  return (
    <>
      <Section title="Progress" id="pp-prog">
        <div className="flex flex-col gap-2">
          {pct != null && (
            <>
              <Progress value={pct} label="Project progress" />
              <span className="t-caption num">{Math.round(pct)}% complete</span>
            </>
          )}
          <div>
            <KV label="Billing">{billing}</KV>
            <KV label="Status">{STATUS_LABEL[project.status]}</KV>
            <KV label="Started">{fmtDate(project.startDate)}</KV>
          </div>
        </div>
      </Section>
      {project.billingType === "retainer" && project.retainerPeriods.length > 0 && (
        <Section title="Billing periods" id="pp-per">
          <ul className="m-0 list-none p-0">
            {project.retainerPeriods.map((r) => {
              const inv = r.invoiceId ? invoices.find((i) => i.id === r.invoiceId) : undefined;
              return (
                <li key={r.id} className="flex items-start justify-between gap-4 border-b border-border py-4">
                  <div className="min-w-0"><LMain>{r.label}</LMain><LSub>{fmtDate(r.start)} to {fmtDate(r.end)}</LSub></div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="num font-semibold">{formatMoney(r.amount, project.currency)}</span>
                    {inv ? <StatusChip status={deriveStatus(inv)} /> : <Tag>Not invoiced yet</Tag>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </>
  );
}

export function InvoicesSection({ invoices, ownerFirst }: { invoices: Invoice[]; ownerFirst: string }) {
  return (
    <Section title="Invoices" id="pp-inv">
      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invoices yet. {ownerFirst} will send one when there is something to pay.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <LedgerRow cols="minmax(0,1fr) auto" href={`/i/${inv.shareToken}`}>
                <div className="min-w-0">
                  <LMain>{inv.number}{inv.lines[0] ? ` · ${inv.lines[0].description}` : ""}</LMain>
                  <LSub>Due {fmtDate(inv.dueDate)}</LSub>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <StatusChip status={deriveStatus(inv)} />
                  <span className="num font-semibold">{formatMoney(calcTotals(inv).total, inv.currency)}</span>
                </div>
              </LedgerRow>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

