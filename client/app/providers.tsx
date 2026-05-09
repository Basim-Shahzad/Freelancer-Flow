"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAuthStore } from "@/stores/useAuthStore";

function AuthInitializer() {
   const hasFetched = useRef(false);
   const auth = useRef(useAuth());

   useEffect(() => {
      if (hasFetched.current) return;
      hasFetched.current = true;

      auth.current.user().catch(() => {
         // fetch failed — set user to null and mark initialized, one atomic update
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
         {children}
      </QueryClientProvider>
   );
}