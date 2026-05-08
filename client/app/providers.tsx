"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
   const queryClient = new QueryClient({
      defaultOptions: {
         queries: {
            staleTime: 10 * 60 * 1000, // 10 minutes in milliseconds (temporary)
            refetchOnWindowFocus: false,
            refetchOnMount: false,
         },
      },
   });

   return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
