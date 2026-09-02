import api from "@/services/api.service";
import {
   User,
   LoginResponse,
   LogoutResponse,
   SignupResponse,
   Tokens,
} from "./types";

export const authApi = {
   register: (signupData: {
      fullName: string;
      email: string;
      password: string;
   }) => api.post<SignupResponse>("/auth/register", signupData),
   login: (loginData: { email: string; password: string }) =>
      api.post<LoginResponse>(`/auth/login`, loginData),
   logout: () => api.post<LogoutResponse>("/auth/logout"),
   me: () => api.get<User>("/auth/me"),
};
