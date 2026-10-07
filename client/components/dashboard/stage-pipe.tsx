import Link from "next/link";
import { fmtDate } from "@/lib/dates";
import { formatHours, amountParts } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CurrencyStages } from "./stages";

/** Chevron tiles collapse to stacked rounded tiles in narrow containers. Drift stripe honours reduced motion. */
const CSS = `
.pl-pipe{display:flex;flex-direction:column;gap:6px}
.pl-tile{position:relative;display:block;min-width:0;overflow:hidden;border-radius:var(--radius);padding:14px 16px;text-decoration:none;transition:transform .18s}
.pl-tile:hover{transform:translateY(-2px)}
.pl-tile:focus-visible{outline:none;box-shadow:inset 0 0 0 3px var(--ring)}
.pl-drift::before{content:"";position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(115deg,transparent 0 16px,color-mix(in srgb,var(--primary-foreground) 9%,transparent) 16px 32px);
  animation:pl-drift 3.4s linear infinite}
@keyframes pl-drift{from{background-position:0 0}to{background-position:72px 0}}
@media (prefers-reduced-motion:reduce){.pl-drift::before{animation:none}.pl-tile{transition:none}.pl-tile:hover{transform:none}}
@container (min-width:48rem){
  .pl-pipe{flex-direction:row;gap:3px}
  .pl-tile{flex:1 1 0;border-radius:0;padding-block:14px 13px;padding-inline:24px 26px;
    clip-path:polygon(0 0,calc(100% - 15px) 0,100% 50%,calc(100% - 15px) 100%,0 100%,15px 50%)}
  .pl-tile:first-child{padding-inline-start:18px;border-start-start-radius:var(--radius);border-end-start-radius:var(--radius);
    clip-path:polygon(0 0,calc(100% - 15px) 0,100% 50%,calc(100% - 15px) 100%,0 100%)}
  .pl-tile:last-child{border-start-end-radius:var(--radius);border-end-end-radius:var(--radius);
    clip-path:polygon(0 0,100% 0,100% 100%,0 100%,15px 50%)}
  [dir=rtl] .pl-tile{clip-path:polygon(15px 0,100% 0,calc(100% - 15px) 50%,100% 100%,15px 100%,0 50%)}
  [dir=rtl] .pl-tile:first-child{clip-path:polygon(15px 0,100% 0,100% 100%,15px 100%,0 50%)}
  [dir=rtl] .pl-tile:last-child{clip-path:polygon(0 0,calc(100% - 15px) 0,100% 50%,calc(100% - 15px) 100%,0 100%)}
}
`;

interface Tile { key: string; name: string; amount: number; line: string; href: string; tone: string; amt: string; drift?: boolean; est?: boolean }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function tilesFor(s: CurrencyStages): Tile[] {
  const unbilledBits = [s.unbilled.minutes > 0 ? `${formatHours(s.unbilled.minutes)} hourly` : null, s.unbilled.items > 0 ? plural(s.unbilled.items, "ready item") : null].filter(Boolean);
  const nextDue = s.out.nextDue ? ` · next due ${fmtDate(s.out.nextDue).slice(0, 6)}` : "";
  return [
    { key: "unbilled", name: "Not billed yet", amount: s.unbilled.amount, est: true, line: unbilledBits.length ? `${unbilledBits.join(" + ")} (est.)` : "Nothing waiting to be billed", href: s.unbilled.minutes > 0 ? "/time" : "/projects",
      tone: "bg-[color-mix(in_srgb,var(--foreground)_6%,var(--background))] text-muted-foreground", amt: "text-foreground" },
    { key: "drafted", name: "Drafted, not sent", amount: s.drafted.amount, line: s.drafted.count ? plural(s.drafted.count, "draft invoice") : "No drafts", href: "/invoices",
      tone: "bg-[color-mix(in_srgb,var(--primary)_10%,var(--background))] text-muted-foreground", amt: "text-foreground" },
    { key: "out", name: "Out with clients", amount: s.out.amount, line: s.out.count ? `${plural(s.out.count, "invoice")}, inside terms${nextDue}` : "Nothing out right now", href: "/invoices",
      tone: "bg-primary text-primary-foreground", amt: "text-primary-foreground", drift: s.out.count > 0 },
    { key: "late", name: "Past due", amount: s.late.amount, line: s.late.count ? `${plural(s.late.count, "invoice")}, oldest ${plural(s.late.oldestDays, "day")} late` : "Nothing past due", href: "/invoices",
      tone: "bg-error-tint text-error-ink", amt: "text-error-ink" },
    { key: "landed", name: "Landed this month", amount: s.landed.amount, line: s.landed.count ? plural(s.landed.count, "payment") : "No payments yet", href: "/invoices",
      tone: "bg-accent-tint text-warning-ink", amt: "text-warning-ink" },
  ];
}

export function StagePipe({ stages }: { stages: CurrencyStages }) {
  return (
    <>
      <style>{CSS}</style>
      <ul className="pl-pipe m-0 list-none p-0" aria-label={`Money by stage, ${stages.currency}`}>
        {tilesFor(stages).map((t) => {
          const { int, dec } = amountParts(t.amount, stages.currency);
          return (
            <li key={t.key} className="contents">
              <Link href={t.href} className={cn("pl-tile", t.tone, t.drift && "pl-drift")}>
                <span className="relative block text-xs font-medium opacity-90">{t.name}</span>
                <span className="relative mt-2 block text-[0.6875rem] font-semibold tracking-widest opacity-80">{stages.currency}{t.est ? " · ≈ est." : ""}</span>
                <span className={cn("num relative block font-serif text-xl font-medium leading-none tracking-[-0.02em]", t.amt)}>
                  {int}{dec && <span className="text-[0.6em] opacity-70">{dec}</span>}
                </span>
                <span className="relative mt-1.5 block text-xs leading-snug opacity-85">{t.line}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
