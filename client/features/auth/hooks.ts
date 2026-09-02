import { authApi } from "./api";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

export function useRegister() {
   return useMutation({
      mutationFn: (signupData: {
         fullName: string;
         email: string;
         password: string;
      }) => authApi.register(signupData),
   });
}

export function useLogin() {
   return useMutation({
      mutationFn: (loginData: { email: string; password: string }) =>
         authApi.login(loginData),
   });
}

export function useLogout() {
   return useMutation({
      mutationFn: () => authApi.logout(),
   });
}

export function useMe() {
   return useQuery({
      queryKey: ["me"],
      queryFn: () => authApi.me(),
   });
}

export interface SignupFormData {
   email: string;
   username: string;
   password: string;
}

export function useSignupForm() {
   return useForm<SignupFormData>({
      defaultValues: {
         email: "",
         username: "",
         password: "",
      },
      mode: "onBlur",
   });
}