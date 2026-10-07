import Link from "next/link";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { NAV_LINKS } from "./nav-links";
import { NavMenu } from "./nav-menu";

export function LandingNav() {
  return (
    <header className="@container border-b border-rule">
      <div className="mx-auto flex w-full max-w-[76rem] items-center gap-2 px-4 py-3 @2xl:gap-3 @2xl:px-6">
        <Logo />
        <nav aria-label="Page" className="ms-6 hidden items-center gap-5 text-sm @3xl:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="inline-flex min-h-11 items-center text-muted-foreground no-underline hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1 @2xl:gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden @xl:inline-flex"><Link href="/login">Log in</Link></Button>
          <Button asChild><Link href="/signup">Start free</Link></Button>
          <NavMenu />
        </div>
      </div>
    </header>
  );
}
