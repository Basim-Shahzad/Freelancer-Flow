import { Logo } from "@/components/brand";
import { StageThread } from "@/components/domain/stage-thread";

export const ASIDE_LINES = {
  default: "From finished work to money in your account.",
  login: "Your work, your invoices, your payments. One thread.",
  forgot: "Locked out happens. Your ledger is safe.",
} as const;

export function AuthAside({ line = ASIDE_LINES.default, className }: { line?: string; className?: string }) {
  return (
    <aside className={className}>
      <Logo />
      <div className="flex max-w-[30rem] flex-col gap-8">
        <p className="t-h1 [text-wrap:pretty]">{line}</p>
        <StageThread stage="instructions" animate={false} />
        <p className="max-w-[44ch] text-sm text-muted-foreground [text-wrap:pretty]">
          Work, approval, invoice, payment instructions, recorded payment. One thread for every project, from Lahore to Austin.
        </p>
      </div>
      <p className="t-caption max-w-[48ch]">Paylancr never holds, moves or charges money.</p>
    </aside>
  );
}
