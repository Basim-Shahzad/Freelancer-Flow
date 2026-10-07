import Link from "next/link";
import { cn } from "@/lib/utils";

/** The thread mark: five nodes on a line (Work → Paid). */
export function ThreadMark({ className }: { className?: string }) {
  return (
    <svg width="34" height="12" viewBox="0 0 34 12" fill="none" stroke="currentColor" aria-hidden="true" className={cn("shrink-0", className)}>
      <path d="M3 6h28" />
      {[3, 10, 17, 24, 31].map((x) => <circle key={x} cx={x} cy="6" r="2" fill="currentColor" />)}
    </svg>
  );
}

export function Logo({ href = "/", className, textClass, hideText }: { href?: string; className?: string; textClass?: string; hideText?: boolean }) {
  return (
    <Link href={href} aria-label="Paylancr home" className={cn("flex items-center gap-3 font-serif text-2xl tracking-[-0.02em] text-foreground no-underline", className)}>
      <ThreadMark />
      {!hideText && <span className={textClass}>Paylancr</span>}
    </Link>
  );
}
