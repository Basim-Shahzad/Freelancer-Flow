import Link from "next/link";
import type { ReactNode } from "react";
import { Money } from "@/components/domain/money";
import { StageThread } from "@/components/domain/stage-thread";
import { StatusChip } from "@/components/domain/status-chip";
import { Button } from "@/components/ui/button";
import type { Currency } from "@/lib/types";
import { cn } from "@/lib/utils";
import { JaliLattice } from "./jali-lattice";
import { ThreadDemo } from "./thread-demo";

export const wrap = "mx-auto w-full max-w-[76rem] px-4 @2xl:px-6";
const h1Cls = "font-serif font-normal text-[length:clamp(2.5rem,7cqi,4.75rem)] leading-[1.02] tracking-[-0.025em] text-balance";
const h2Cls = "font-serif font-normal text-[length:clamp(1.75rem,4cqi,2.75rem)] leading-[1.1] tracking-[-0.02em] text-balance";

export interface Row { title: string; body: string }
export interface MethodItem { name: string; body: string }

/* ---------------------------------------------------------------- Hero */

export interface HeroProps {
  eyebrow: string;
  headline: string;
  lede: string;
  specimenNote: string;
  estimateIn: Currency;
  lattice?: boolean;
}

export function Hero({ eyebrow, headline, lede, specimenNote, estimateIn, lattice }: HeroProps) {
  return (
    <section aria-labelledby="h1" className="relative overflow-hidden">
      {lattice && <JaliLattice />}
      <div className={cn(wrap, "relative grid items-center gap-10 py-12 @3xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] @3xl:gap-16 @3xl:py-24")}>
        <div className="flex flex-col gap-7">
          <span className="t-eyebrow">{eyebrow}</span>
          <h1 id="h1" className={h1Cls}>{headline}</h1>
          <p className="max-w-[38rem] text-lg leading-relaxed text-muted-foreground [text-wrap:pretty]">{lede}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild><Link href="/signup">Start free</Link></Button>
            <Button asChild variant="outline"><a href="#thread">See how it works</a></Button>
          </div>
          <span className="t-caption">Free to start. Clients never need an account.</span>
        </div>
        <div
          role="img"
          aria-label="Sample invoice INV-0042 for Harbor Labs, USD 1,250.00, awaiting payment"
          className="flex flex-col gap-4 rounded-lg border border-rule bg-surface p-5"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="t-eyebrow">INV-0042 · Harbor Labs</span>
            <StatusChip status="unpaid" />
          </div>
          <Money size="hero" currency="USD" amount={125000} estimateIn={estimateIn} note />
          <StageThread stage="instructions" caption="Instructions shared · waiting for payment" animate={false} />
          <span className="t-caption">{specimenNote}</span>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Sections */

function SectionShell({ id, labelId, eyebrow, title, body, children }: { id?: string; labelId: string; eyebrow: string; title: string; body: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={labelId} className="scroll-mt-4 border-t border-rule">
      <div className={cn(wrap, "grid items-start gap-5 py-12 @3xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] @3xl:gap-16 @3xl:py-20")}>
        <header className="flex flex-col gap-3 @3xl:sticky @3xl:top-5">
          <span className="t-eyebrow">{eyebrow}</span>
          <h2 id={labelId} className={h2Cls}>{title}</h2>
          <p className="text-base text-muted-foreground [text-wrap:pretty]">{body}</p>
        </header>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

function NumberedRows({ rows, label }: { rows: Row[]; label?: string }) {
  return (
    <ol aria-label={label} className="m-0 list-none border-t border-border p-0">
      {rows.map((r, i) => (
        <li key={r.title} className="grid grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-x-5 gap-y-1 border-b border-border py-5 @3xl:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1.4fr)]">
          <span aria-hidden="true" className="num font-serif text-xl text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
          <h3 className="t-h3">{r.title}</h3>
          <p className="col-start-2 text-base text-muted-foreground [text-wrap:pretty] @3xl:col-start-3">{r.body}</p>
        </li>
      ))}
    </ol>
  );
}

export const THREAD_ROWS: Row[] = [
  { title: "Work", body: "Track time by the hour, or set a fixed price, a monthly retainer or milestones. Switch a running timer on from anywhere in the app." },
  { title: "Approval", body: "Share one private link. Your client sees progress and approves a milestone or asks for changes with a comment. No account needed." },
  { title: "Invoice", body: "Tick the time or milestones that are ready, add a line or two, and review. Under five minutes, with a PDF that matches what you see." },
  { title: "Instructions", body: "Your payment details sit on the invoice with a copy button next to each one. Clients pay you directly; there is no pay button." },
  { title: "Paid", body: "Record the payment when the money lands, attach the receipt, and the thread closes. That is the only moment we celebrate." },
];

export function ThreadSection() {
  return (
    <SectionShell
      id="thread" labelId="t-h" eyebrow="The thread" title="One line from work to paid."
      body="Every project and invoice shows where it sits on the same five steps, so you always know what is next and so does your client."
    >
      <ThreadDemo />
      <div className="pt-6"><NumberedRows rows={THREAD_ROWS} label="The five steps" /></div>
    </SectionShell>
  );
}

export function MethodsSection({ title, body, items }: { title: string; body: string; items: MethodItem[] }) {
  return (
    <SectionShell id="methods" labelId="m-h" eyebrow="Getting paid" title={title} body={body}>
      <dl className="m-0 border-t border-border">
        {items.map((m) => (
          <div key={m.name} className="grid gap-1 border-b border-border py-4 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] @3xl:items-baseline @3xl:gap-5">
            <dt className="font-semibold">{m.name}</dt>
            <dd className="m-0 text-sm text-muted-foreground">{m.body}</dd>
          </div>
        ))}
      </dl>
    </SectionShell>
  );
}

export function FeaturesSection({ title, body, rows }: { title: string; body: string; rows: Row[] }) {
  return (
    <SectionShell labelId="f-h" eyebrow="Built for how you work" title={title} body={body}>
      <NumberedRows rows={rows} />
    </SectionShell>
  );
}

export function ClientSection({ children }: { children: ReactNode }) {
  return (
    <SectionShell
      id="client" labelId="c-h" eyebrow="What clients see" title="A page your client can act on in seconds."
      body="The amount, the due date, and each payment detail with a copy button. A PDF to download. No login, no pay button, and no surprise: the page says plainly that Paylancr does not process payments."
    >
      {children}
    </SectionShell>
  );
}

export function NeverTouchBand() {
  return (
    <section aria-labelledby="never-h" className="border-y border-rule">
      <div className={cn(wrap, "flex flex-wrap items-baseline justify-between gap-5 py-8")}>
        <h2 id="never-h" className={cn(h2Cls, "max-w-[24ch]")}>We never touch your money.</h2>
        <p className="max-w-[40ch] text-base text-muted-foreground [text-wrap:pretty]">
          Paylancr does not process payments. It helps you track work, bill clearly and see who has paid. Your clients pay you directly, however you both prefer.
        </p>
      </div>
    </section>
  );
}

export function FinalCta({ title }: { title: string }) {
  return (
    <section aria-labelledby="cta-h" className="border-t border-rule">
      <div className={cn(wrap, "flex flex-col items-start gap-5 py-16 @3xl:py-24")}>
        <span className="t-eyebrow">Ready when you are</span>
        <h2 id="cta-h" className={cn(h1Cls, "text-[length:clamp(2rem,5cqi,3.5rem)]")}>{title}</h2>
        <div className="flex flex-wrap gap-3">
          <Button asChild><Link href="/signup">Start free</Link></Button>
          <Button asChild variant="ghost"><Link href="/login">I already have an account</Link></Button>
        </div>
      </div>
    </section>
  );
}
