import { useEffect } from "react";
import { useCurrentUser } from "@/features/auth/hooks.js";
import { useAuthStore } from "@/features/auth/store.js";

/**
 * AuthInitializer Component
 *
 * This component should be placed at the root of your app (in App.tsx or main layout).
 * It initializes the auth state on app load by checking for existing tokens
 * and fetching the current user if authenticated.
 *
 * Usage in App.tsx:
 * ```tsx
 * function App() {
 *   return (
 *     <QueryClientProvider client={queryClient}>
 *       <AuthInitializer />
 *       <RouterProvider router={router} />
 *     </QueryClientProvider>
 *   );
 * }
 * ```
 */
export const AuthInitializer = () => {
   const { isLoading, isError } = useCurrentUser();
   const { setInitialized, isInitialized } = useAuthStore();

   useEffect(() => {
      // If no token exists, mark as initialized immediately
      const token = localStorage.getItem("access");
      if (!token && !isInitialized) {
         setInitialized(true);
      }
   }, [setInitialized, isInitialized]);

   useEffect(() => {
      // Once the query completes (success or error), ensure initialized is set
      if (!isLoading && !isInitialized) {
         setInitialized(true);
      }
   }, [isLoading, isInitialized, setInitialized]);

   // This component doesn't render anything
   return null;
};
