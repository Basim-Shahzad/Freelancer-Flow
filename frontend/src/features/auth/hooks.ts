import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "./api.js";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "./store.js";
import toast from "react-hot-toast";

export const useCurrentUser = () => {
   const setAuth = useAuthStore((state) => state.setAuth);
   const setInitialized = useAuthStore((state) => state.setInitialized);
   const token = localStorage.getItem("access");

   return useQuery({
      queryKey: ["currentUser"],
      queryFn: async () => {
         try {
            const user = await authApi.getCurrentUser();
            setAuth(user);
            return user;
         } catch (error) {
            console.error("Failed to fetch current user:", error);
            setAuth(null);
            throw error;
         } finally {
            setInitialized(true);
         }
      },
      enabled: !!token,
      retry: 1,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
   });
};

export const useLogin = () => {
   const queryClient = useQueryClient();
   const navigate = useNavigate();
   const setAuth = useAuthStore((state) => state.setAuth);

   return useMutation({
      mutationFn: authApi.login,
      onSuccess: async (data) => {
         try {
            if (!data.access || !data.refresh) {
               throw new Error("Invalid response: missing tokens");
            }

            localStorage.setItem("access", data.access);
            localStorage.setItem("refresh", data.refresh);

            const user = await queryClient.fetchQuery({
               queryKey: ["currentUser"],
               queryFn: authApi.getCurrentUser,
            });

            setAuth(user);

            toast.success("Welcome back!");

            setTimeout(() => {
               navigate("/dashboard", { replace: true });
            }, 0);
         } catch (error) {
            console.error("Login post-processing failed:", error);
            toast.error("Login succeeded but failed to load user data. Please refresh.");

            setTimeout(() => {
               navigate("/dashboard", { replace: true });
            }, 100);
         }
      },
      onError: (error: any) => {
         console.error("Login failed:", error);

         const errorMessage =
            error?.response?.data?.detail ||
            error?.response?.data?.message ||
            error?.message ||
            "Invalid credentials. Please try again.";

         toast.error(errorMessage);
      },
   });
};

export const useSignup = () => {
   const queryClient = useQueryClient();
   const navigate = useNavigate();
   const setAuth = useAuthStore((state) => state.setAuth);

   return useMutation({
      mutationFn: authApi.signup,
      onSuccess: async (data) => {
         try {
            if (!data.access || !data.refresh) {
               throw new Error("Invalid response: missing tokens");
            }

            localStorage.setItem("access", data.access);
            localStorage.setItem("refresh", data.refresh);

            const user = await queryClient.fetchQuery({
               queryKey: ["currentUser"],
               queryFn: authApi.getCurrentUser,
            });

            setAuth(user);

            toast.success("Account created successfully!");

            setTimeout(() => {
               navigate("/dashboard", { replace: true });
            }, 0);
         } catch (error) {
            console.error("Signup post-processing failed:", error);
            toast.error("Account created but failed to load user data. Please refresh.");

            setTimeout(() => {
               navigate("/dashboard", { replace: true });
            }, 100);
         }
      },
      onError: (error: any) => {
         console.error("Signup failed:", error);

         const errors = error?.response?.data;
         let errorMessage = "Signup failed. Please try again.";

         if (errors) {
            if (errors.email && Array.isArray(errors.email)) {
               errorMessage = errors.email[0];
            } else if (errors.username && Array.isArray(errors.username)) {
               errorMessage = errors.username[0];
            } else if (errors.password && Array.isArray(errors.password)) {
               errorMessage = errors.password[0];
            } else if (errors.detail) {
               errorMessage = errors.detail;
            } else if (errors.message) {
               errorMessage = errors.message;
            }
         } else if (error?.message) {
            errorMessage = error.message;
         }

         toast.error(errorMessage);
      },
   });
};

export const useLogout = () => {
   const queryClient = useQueryClient();
   const navigate = useNavigate();
   const logout = useAuthStore((state) => state.logout);

   return useMutation({
      mutationFn: async () => {
         const refreshToken = localStorage.getItem("refresh");
         if (refreshToken) {
            await authApi.logout(refreshToken);
         }
      },
      onSuccess: () => {
         logout();
         queryClient.clear();
         toast.success("Logged out successfully");
      },
      onError: (error: any) => {
         console.error("Logout failed:", error);
         logout();
         queryClient.clear();
      },
   });
};
