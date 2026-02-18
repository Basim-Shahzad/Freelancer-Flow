import { api } from "@/hooks/useApi.js";
import type { User, AuthResponse, SignupCredentials, LoginCredentials } from "./types.js";

export const authApi = {
   login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
      const { data } = await api.post<AuthResponse>("/auth/login/", credentials);
      return data;
   },

   signup: async (signupData: SignupCredentials): Promise<AuthResponse> => {
      const { data } = await api.post<AuthResponse>("/auth/registration/", signupData);
      return data;
   },

   logout: async (): Promise<void> => {
      await api.post("/auth/logout/");
   },

   getCurrentUser: async (): Promise<User> => {
      const { data } = await api.get<User>("/auth/user/");
      return data;
   },
};
