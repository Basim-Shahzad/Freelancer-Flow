import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store.js";

interface ProtectedRouteProps {
   children: React.ReactNode;
   redirectTo?: string;
}
export const ProtectedRoute = ({ children, redirectTo = "/login" }: ProtectedRouteProps) => {
   const { isAuthenticated, isInitialized } = useAuthStore();
   const location = useLocation();

   // Show loading spinner while auth state is being initialized
   if (!isInitialized) {
      return (
         <div className="h-screen w-screen flex items-center justify-center bg-[#0C0E12]">
            <div className="flex flex-col items-center gap-4">
               <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
               <p className="text-white/60 text-sm">Loading...</p>
            </div>
         </div>
      );
   }

   // Redirect to login if not authenticated, preserving the intended destination
   if (!isAuthenticated) {
      return <Navigate to={redirectTo} state={{ from: location }} replace />;
   }

   // Render the protected content
   return <>{children}</>;
};