"use client";

import { useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthBootstrap } from "@/lib/hooks/auth";
import { useTimeSync } from "@/lib/hooks/time-entries";
import { makeQueryClient } from "@/lib/query-client";
import { useOnlineSync } from "@/lib/hooks/use-online";

/** Removed mock-store persistence key; cleared once so stale demo data does not linger in browsers. */
const LEGACY_STORE_KEY = "paylancr-v1";

export function clearLegacyStore() {
  try { localStorage.removeItem(LEGACY_STORE_KEY); } catch { /* storage unavailable */ }
}

/** Tracks connectivity, bootstraps auth and flushes the time outbox. */
function AppBootstrap() {
  useEffect(clearLegacyStore, []);
  useOnlineSync();
  useAuthBootstrap();
  useTimeSync();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={200}>
        <AppBootstrap />
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
