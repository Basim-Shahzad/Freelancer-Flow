"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAuthStore } from "@/stores/useAuthStore";

function AuthInitializer() {
   const setInitialized = useAuthStore((s) => s.setInitialized);
   const hasFetched = useRef(false);
   const auth = useRef(useAuth());

   useEffect(() => {
      if (hasFetched.current) return;
      hasFetched.current = true;

      auth.current
         .user()
         .catch(() => {
            useAuthStore.getState().logout();
         })
         .finally(() => {
            setInitialized(true);
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
