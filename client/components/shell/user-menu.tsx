"use client";

import { useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/lib/store";

const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export function UserMenu() {
  const router = useRouter();
  const user = useAppStore((s) => s.session.user);
  const logOut = useAppStore((s) => s.logOut);
  const name = user?.name ?? "You";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Account menu" className="grid size-9 cursor-pointer place-items-center rounded-full border border-rule bg-transparent text-xs font-bold tracking-wide hover:bg-hover">
        {initials(name)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{user?.email ?? name}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => router.push("/settings")}><Settings className="size-4" aria-hidden="true" />Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => { logOut(); router.push("/login"); }}><LogOut className="size-4" aria-hidden="true" />Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
