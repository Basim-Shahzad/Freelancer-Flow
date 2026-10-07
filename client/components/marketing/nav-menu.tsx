"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { NAV_LINKS } from "./nav-links";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Mobile menu: a dialog with the page anchors and the account links. */
export function NavMenu() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Open menu" className="@3xl:hidden">
          <Menu aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent side="start" className="gap-6 p-6">
        <DialogTitle>Menu</DialogTitle>
        <DialogDescription className="sr-only">Jump to a section or open your account.</DialogDescription>
        <nav aria-label="Page sections" className="flex flex-col">
          {NAV_LINKS.map((l) => (
            <DialogClose key={l.href} asChild>
              <a href={l.href} className="flex min-h-12 items-center border-b border-border text-base text-foreground no-underline hover:bg-hover">
                {l.label}
              </a>
            </DialogClose>
          ))}
        </nav>
        <div className="flex flex-col gap-2">
          <Button asChild block><Link href="/signup">Start free</Link></Button>
          <Button asChild variant="outline" block><Link href="/login">Log in</Link></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
