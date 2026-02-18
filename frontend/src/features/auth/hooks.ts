import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "./api.js";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "./store.js";
import { toast } from "react-hot-toast";

export const useCurrentUser = () => {
   const setAuth = useAuthStore((state) => state.setAuth);
   const setInitialized = useAuthStore((state) => state.setInitialized);

   return useQuery({
      queryKey: ["currentUser"],
      queryFn: async () => {
         try {
            const user = await authApi.getCurrentUser();
            setAuth(user);
            return user;
         } catch (error) {
            setAuth(null);
            throw error;
         } finally {
            setInitialized(true);
         }
      },
      retry: false,
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
      onSuccess: async () => {
         try {
            const user = await queryClient.fetchQuery({
               queryKey: ["currentUser"],
               queryFn: authApi.getCurrentUser,
            });
            setAuth(user);
            toast.success("Welcome back!");
            navigate("/dashboard", { replace: true });
         } catch {
            toast.error("Login succeeded but failed to load user data. Please refresh.");
            navigate("/dashboard", { replace: true });
         }
      },
      onError: (error: any) => {
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
      onSuccess: async () => {
         try {
            const user = await queryClient.fetchQuery({
               queryKey: ["currentUser"],
               queryFn: authApi.getCurrentUser,
            });
            setAuth(user);
            toast.success("Account created successfully!");
            navigate("/dashboard", { replace: true });
         } catch {
            toast.error("Account created but failed to load user data. Please refresh.");
            navigate("/dashboard", { replace: true });
         }
      },
      onError: (error: any) => {
         const errors = error?.response?.data;
         let errorMessage = "Signup failed. Please try again.";

         if (errors) {
            const firstField = ["email", "username", "password1", "detail", "message"].find((f) => errors[f]);
            if (firstField) {
               errorMessage = Array.isArray(errors[firstField]) ? errors[firstField][0] : errors[firstField];
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
      mutationFn: authApi.logout,
      onSettled: () => {
         // always logout client-side regardless of server response
         logout();
         queryClient.clear();
         navigate("/login", { replace: true });
         toast.success("Logged out successfully");
      },
   });
};
