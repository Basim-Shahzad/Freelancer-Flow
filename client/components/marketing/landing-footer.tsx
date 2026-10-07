import Link from "next/link";
import { Logo } from "@/components/brand";

export function LandingFooter() {
  return (
    <footer className="@container border-t border-rule">
      <div className="mx-auto flex w-full max-w-[76rem] flex-wrap items-center justify-between gap-x-6 gap-y-4 px-4 py-6 text-sm text-muted-foreground @2xl:px-6">
        <Logo className="text-xl" />
        <p>Paylancr does not process payments. Clients pay you directly.</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5">
          <Link href="/login" className="inline-flex min-h-11 items-center text-inherit">Log in</Link>
          <Link href="/signup" className="inline-flex min-h-11 items-center text-inherit">Sign up</Link>
          <a href="#" className="inline-flex min-h-11 items-center text-inherit">Privacy</a>
          <a href="#" className="inline-flex min-h-11 items-center text-inherit">Terms</a>
        </nav>
      </div>
    </footer>
  );
}
