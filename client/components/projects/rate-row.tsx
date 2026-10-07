import { Money } from "@/components/domain/money";
import { LCell, LedgerRow, LMain } from "@/components/ui/ledger";
import { ESTIMATE_LABEL, FX_REF_DATE } from "@/lib/fx";
import { fmtDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { ClientDot } from "./client-dot";
import { ProjectStatusChip } from "./project-status-chip";
import { billingSummary, hoursText, MIN_RATE_MINUTES, VERDICT_TEXT, type RateRow } from "./rate";

const COLS = "minmax(0,1fr) auto";

function BigFigure({ r }: { r: RateRow }) {
  const p = r.project;
  if (r.rate === null) {
    return (
      <>
        <span className="num font-serif text-3xl leading-none text-muted-foreground" aria-label="No rate yet">—</span>
        <span className="text-xs text-muted-foreground">{r.kind === "hourly" ? "rate not set" : `needs ${hoursText(MIN_RATE_MINUTES)} of billable time`}</span>
      </>
    );
  }
  return (
    <>
      <Money amount={r.rate} currency={p.currency} size="lg" align="end" negative={r.verdict === "below"} />
      <span className="text-xs text-muted-foreground">{r.kind === "hourly" ? "an hour, your contract rate" : `an hour, at ${hoursText(r.minutes)}`}</span>
    </>
  );
}

function Detail({ r }: { r: RateRow }) {
  const p = r.project;
  const bits: React.ReactNode[] = [];
  if (r.buysMinutes !== null && r.overMinutes !== null) {
    bits.push(<span key="h">{hoursText(r.minutes)} of ≈{hoursText(r.buysMinutes)} the fee buys at your rate</span>);
    bits.push(r.overMinutes > 0
      ? <span key="o" className="font-medium text-error-ink">{hoursText(r.overMinutes)} over</span>
      : <span key="o">{hoursText(-r.overMinutes)} to spare</span>);
  } else {
    bits.push(<span key="h">{hoursText(r.minutes)} logged</span>);
  }
  if (r.notInvoiced > 0) bits.push(<span key="n"><b className="num font-semibold text-foreground">{formatMoney(r.notInvoiced, p.currency)}</b> not invoiced yet</span>);
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-sm text-muted-foreground">
      <p className="m-0 flex flex-wrap gap-x-2">
        {bits.map((b, i) => <span key={i} className="inline-flex gap-2">{i > 0 && <span aria-hidden="true">·</span>}{b}</span>)}
      </p>
      {r.verdict && (
        <p className={`m-0 font-medium ${r.verdict === "below" ? "text-error-ink" : r.verdict === "above" ? "text-success-ink" : ""}`}>{VERDICT_TEXT[r.verdict]}</p>
      )}
    </div>
  );
}

/** One ledger-style row: who/what on the start side, the real hourly figure on the end side, one detail line beneath. */
export function RateLedgerRow({ r, clientName, clientIds }: { r: RateRow; clientName: string; clientIds: readonly string[] }) {
  const p = r.project;
  return (
    <LedgerRow cols={COLS} href={`/projects/${p.id}`} className="gap-y-2 px-5 last:border-b-0">
      <LCell>
        <LMain className="text-base">{p.name}</LMain>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><ClientDot clientId={p.clientId} clientIds={clientIds} />{clientName}</span>
          <ProjectStatusChip status={p.status} />
          <span>{billingSummary(r)}</span>
        </div>
      </LCell>
      <LCell end className="flex flex-col items-end gap-1"><BigFigure r={r} /></LCell>
      <LCell className="col-span-full"><Detail r={r} /></LCell>
      {r.floor?.estimated && r.verdict && (
        <LCell className="col-span-full"><p className="m-0 text-xs text-muted-foreground">Your rate is compared as {formatMoney(r.floor.amount, p.currency)} an hour · {ESTIMATE_LABEL} · ref. rate {fmtDate(FX_REF_DATE)}.</p></LCell>
      )}
    </LedgerRow>
  );
}
