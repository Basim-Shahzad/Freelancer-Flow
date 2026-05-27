import { useAuthStore } from "@/stores/useAuthStore";
import api from "@/services/api.service";
import type { LoginResponse, SignupResponse, User, LogoutResponse } from "@/types/auth.types";

export const useAuth = () => ({
   signup: async (signupData: { fullName: string; email: string; password: string }) => {
      const { data } = await api.post<SignupResponse>("/auth/register", signupData, {
         _skipRefresh: true,
      } as any);
      const loginData = await useAuth().login({ email: signupData.email, password: signupData.password });
      useAuthStore.getState().login(data, loginData.accessToken);
      return data;
   },

   login: async (loginData: { email: string; password: string }) => {
      sessionStorage.removeItem("refreshFailed");
      const { data } = await api.post<LoginResponse>("/auth/login", loginData, {
         _skipRefresh: true, // ← don't intercept 401s on login
      } as any);
      useAuthStore.getState().setAccessToken(data.accessToken);
      return data;
   },

   logout: async () => {
      const res = await api.post<LogoutResponse>("/auth/logout");
      if (res.status === 200) {
         useAuthStore.getState().logout();
      }
      return res.data;
   },

   user: async () => {
      const { data } = await api.get<User>("/auth/me");
      // single atomic update — user and isInitialized set together, one render
      useAuthStore.getState().setAuthInitialized(data);
      return data;
   },
});
