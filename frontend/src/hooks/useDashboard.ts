import { useApi } from "./useApi.js";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/Contexts/AuthContext.js";

export function useDashboard() {
   const { api } = useApi();
   const { isInitialized, isLoggedin } = useAuth();

   const {
      data: revenue,
      isLoading,
      isError,
      error,
      refetch,
   } = useQuery({
      queryKey: ["revenue"],
      queryFn: async () => {
         const res = await api.get("/get-revenue");
         return res.data;
      },
      // Only run if auth is ready
      enabled: !!(isInitialized && isLoggedin),
      // Cache settings for a dashboard (don't refetch every 2 seconds)
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1, // Don't spam the server if it fails
   });

   return {
      revenue,
      isLoading,
      isError,
      error,
      refreshDashboard: refetch,
   };
}