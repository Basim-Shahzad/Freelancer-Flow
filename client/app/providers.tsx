"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect } from "react";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAuthStore } from "@/stores/useAuthStore";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@heroui/react";

let authInitialized = false;

function AuthInitializer() {
   const auth = useAuth();

   useEffect(() => {
      if (authInitialized) return;
      authInitialized = true;

      auth.user().catch(() => {
         useAuthStore.getState().setAuthInitialized(null);
      });
   }, []);

   return null;
}

const queryClient = new QueryClient({
   defaultOptions: {
      queries: {
         staleTime: 10 * 60 * 1000,
         refetchOnWindowFocus: false,
         refetchOnMount: false,
      },
   },
});

export default function Providers({ children }: { children: ReactNode }) {
   return (
      <QueryClientProvider client={queryClient}>
         <AuthInitializer />
         <ReactQueryDevtools initialIsOpen={false} />
         <ThemeProvider attribute="class" defaultTheme="dark">
            <ToastProvider />
            {children}
         </ThemeProvider>
      </QueryClientProvider>
   );
}
