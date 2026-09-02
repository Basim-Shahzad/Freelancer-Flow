import api from "@/services/api.service";
import {
   User,
   LoginResponse,
   LogoutResponse,
   SignupResponse,
   Tokens,
} from "./types";

export const authApi = {
   register: async (signupData: {
      fullName: string;
      email: string;
      password: string;
   }) => {
      const response = await api.post<SignupResponse>(
         "/auth/register",
         signupData,
      );

      return response.data;
   },

   login: async (loginData: { email: string; password: string }) => {
      const response = await api.post<LoginResponse>("/auth/login", loginData);

      return response.data;
   },

   logout: async () => {
      const response = await api.post<LogoutResponse>("/auth/logout");
      return response.data;
   },

   me: async () => {
      const response = await api.get<User>("/auth/me");
      return response.data;
   },
};
