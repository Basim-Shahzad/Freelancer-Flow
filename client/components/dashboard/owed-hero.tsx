"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { amountParts, formatMoney } from "@/lib/money";
import type { Currency } from "@/lib/types";
import { StagePipe } from "./stage-pipe";
import type { CurrencyStages } from "./stages";

/** Hero note, from real figures: how much of what is owed is late vs still inside terms. */
export function owedNote(s: CurrencyStages): { late?: string; rest: string } {
  if (s.owed === 0) return { rest: "Nothing is waiting on a client right now." };
  if (s.late.amount === 0) return { rest: `None of it is late — all of it is still inside terms.` };
  if (s.out.amount === 0) return { late: `${formatMoney(s.late.amount, s.currency)} of it is late`, rest: " — all of it is past its due date." };
  return { late: `${formatMoney(s.late.amount, s.currency)} of it is late`, rest: ` — the other ${formatMoney(s.out.amount, s.currency)} is still inside terms.` };
}

/** "Owed to you" hero: big figure + stage tiles. Multi-currency: a pill selector drives both; others are listed, never summed. */
export function OwedHero({ stages, currencies, base, paidDays }: {
  stages: Partial<Record<Currency, CurrencyStages>>; currencies: Currency[]; base: Currency; paidDays: { days: number; n: number } | null;
}) {
  const [picked, setPicked] = useState<Currency>(base);
  const cur = currencies.includes(picked) ? picked : (currencies[0] ?? base);
  const s: CurrencyStages = stages[cur] ?? { currency: cur, unbilled: { amount: 0, count: 0, minutes: 0, items: 0 }, drafted: { amount: 0, count: 0 }, out: { amount: 0, count: 0 }, late: { amount: 0, count: 0, oldestDays: 0 }, landed: { amount: 0, count: 0 }, owed: 0 };
  const others = currencies.filter((c) => c !== cur && (stages[c]?.owed ?? 0) > 0);
  const { int, dec } = amountParts(s.owed, cur);
  const note = owedNote(s);

  return (
    <section aria-labelledby="d-owed" className="grid min-w-0 gap-x-10 gap-y-6 @6xl:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="d-owed" className="text-sm text-muted-foreground">Owed to you, not yet in your account</h2>
          {currencies.length > 1 && (
            <Segmented<Currency> label="Currency" value={cur} onChange={setPicked} options={currencies.map((c) => ({ value: c, label: c }))} />
          )}
        </div>
        <p className="mt-1 flex items-baseline gap-2.5">
          <span className="text-sm font-semibold tracking-widest text-muted-foreground">{cur}</span>
          <span className="num font-serif text-[clamp(2.75rem,5.2cqi,4rem)] font-medium leading-none tracking-[-0.035em]" aria-label={`${cur} ${int}${dec}`}>
            {int}{dec && <span className="text-[0.45em] tracking-normal text-muted-foreground">{dec}</span>}
          </span>
        </p>
        <p className="mt-2 max-w-[34ch] text-sm text-muted-foreground">
          {note.late && <b className="font-semibold text-error-ink">{note.late}</b>}{note.rest}
        </p>
        {others.length > 0 && (
          <p className="num mt-3 text-sm text-muted-foreground">
            Also owed: {others.map((c) => formatMoney(stages[c]?.owed ?? 0, c)).join(" · ")}
          </p>
        )}
      </div>
      <div className="min-w-0">
        <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4">
          <h3 className="font-serif text-base font-medium">Where the money is standing</h3>
          <span className="text-xs text-muted-foreground">Tap a stage to open it</span>
        </div>
        <StagePipe stages={s} />
        <div className="mt-2.5 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{paidDays ? <>Sent to paid, across every client: <b className="num font-semibold text-foreground">{paidDays.days} {paidDays.days === 1 ? "day" : "days"}</b></> : null}</span>
          <span>Amounts are in {cur}; currencies are never added together.</span>
        </div>
      </div>
    </section>
  );
}
