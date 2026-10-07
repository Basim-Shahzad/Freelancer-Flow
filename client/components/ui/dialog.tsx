"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: "center" | "start" }
>(({ className, children, side = "center", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--foreground)_45%,transparent)]" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 flex flex-col gap-4 border border-rule bg-surface p-6 text-foreground focus:outline-none",
        side === "center" ? "start-1/2 top-1/2 w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg rtl:translate-x-1/2" : "inset-y-0 start-0 w-[min(86vw,20rem)] border-s-0 p-0",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute end-3 top-3 grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-hover" aria-label="Close">
        <X className="size-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

export const DialogTitle = React.forwardRef<React.ComponentRef<typeof DialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(
  ({ className, ...props }, ref) => <DialogPrimitive.Title ref={ref} className={cn("t-h3", className)} {...props} />,
);
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = React.forwardRef<React.ComponentRef<typeof DialogPrimitive.Description>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(
  ({ className, ...props }, ref) => <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />,
);
DialogDescription.displayName = "DialogDescription";
