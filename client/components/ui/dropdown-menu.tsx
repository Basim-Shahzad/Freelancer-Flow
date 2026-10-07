"use client";

import * as React from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export const DropdownMenuContent = React.forwardRef<React.ComponentRef<typeof Menu.Content>, React.ComponentPropsWithoutRef<typeof Menu.Content>>(
  ({ className, sideOffset = 6, ...props }, ref) => (
    <Menu.Portal>
      <Menu.Content ref={ref} sideOffset={sideOffset} className={cn("z-50 min-w-48 rounded-lg border border-rule bg-surface p-1.5 text-foreground", className)} {...props} />
    </Menu.Portal>
  ),
);
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuItem = React.forwardRef<React.ComponentRef<typeof Menu.Item>, React.ComponentPropsWithoutRef<typeof Menu.Item> & { destructive?: boolean }>(
  ({ className, destructive, ...props }, ref) => (
    <Menu.Item ref={ref} className={cn("flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-md px-3 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-hover", destructive && "text-error-ink", className)} {...props} />
  ),
);
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuSeparator = ({ className }: { className?: string }) => <Menu.Separator className={cn("my-1 h-px bg-border", className)} />;
export const DropdownMenuLabel = ({ className, children }: { className?: string; children: React.ReactNode }) => <Menu.Label className={cn("t-eyebrow px-3 py-2", className)}>{children}</Menu.Label>;
