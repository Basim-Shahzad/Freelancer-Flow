"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useOnlineSync } from "@/lib/hooks/use-online";
import { useAppStore } from "@/lib/store";

/** Loads persisted data after mount (avoids SSR hydration mismatches) and tracks connectivity. */
function StoreBootstrap() {
  useEffect(() => {
    const done = () => useAppStore.getState().setHydrated(true);
    const p = useAppStore.persist.rehydrate();
    if (p && typeof (p as Promise<void>).then === "function") (p as Promise<void>).then(done, done);
    else done();
  }, []);
  useOnlineSync();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={200}>
        <StoreBootstrap />
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            classNames: {
              toast: "!bg-surface !text-foreground !border !border-rule !rounded-lg !shadow-none !font-sans",
              description: "!text-muted-foreground",
            },
          }}
        />
      </TooltipProvider>
    </ThemeProvider>
  );
}
