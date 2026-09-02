"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect } from "react";
import { useMe } from "@/features/auth/hooks";
import { useAuthStore } from "@/features/auth/store";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@heroui/react";

let authInitialized = false;

function AuthInitializer() {
   const {
      data: res,
      isLoading: isLoadingUser,
      isError: isErrorUser,
   } = useMe();

   const updateUser = useAuthStore((state) => state.updateUser);

   useEffect(() => {
      if (!res || isLoadingUser || isErrorUser || authInitialized) return;
      updateUser(res?.data);
   }, [res, updateUser]);

   return null;
}

export const queryClient = new QueryClient({
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
         <ThemeProvider attribute="class" defaultTheme="light">
            <ToastProvider />
            {children}
         </ThemeProvider>
      </QueryClientProvider>
   );
}
