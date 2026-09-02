import { authApi } from "./api";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { LoginResponse, LogoutResponse, SignupResponse, User } from "./types";
import { AxiosError } from "axios";

export function useRegister() {
   return useMutation<
      SignupResponse,
      AxiosError<ApiValidationError>,
      { fullName: string; email: string; password: string }
   >({
      mutationFn: (signupData) => authApi.register(signupData),
   });
}

export function useLogin() {
   return useMutation<
      LoginResponse,
      AxiosError<ApiValidationError>,
      { email: string; password: string }
   >({
      mutationFn: authApi.login,
   });
}

export function useLogout() {
   return useMutation<
      LogoutResponse,
      AxiosError<ApiValidationError>
   >({
      mutationFn: () => authApi.logout(),
   });
}

export function useMe() {
   return useQuery<User, AxiosError<ApiError>>({
      queryKey: ["me"],
      queryFn: () => authApi.me(),
   });
}

export interface SignupFormData {
   email: string;
   fullName: string;
   password: string;
}

export function useSignupForm() {
   return useForm<SignupFormData>({
      defaultValues: {
         email: "",
         fullName: "",
         password: "",
      },
      mode: "onBlur",
   });
}
