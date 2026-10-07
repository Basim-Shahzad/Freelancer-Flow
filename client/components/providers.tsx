"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthBootstrap } from "@/lib/hooks/auth";
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
  useAuthBootstrap();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}
