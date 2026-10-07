"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<React.ComponentRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.List ref={ref} className={cn("flex gap-6 overflow-x-auto border-b border-rule", className)} {...props} />
  ),
);
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<React.ComponentRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn("-mb-px min-h-11 cursor-pointer whitespace-nowrap border-0 border-b-2 border-transparent bg-transparent text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:font-bold data-[state=active]:text-foreground", className)}
      {...props}
    />
  ),
);
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = TabsPrimitive.Content;
