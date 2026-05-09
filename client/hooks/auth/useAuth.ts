import { useAuthStore } from "@/stores/useAuthStore";
import api from "@/services/api.service";
import type { LoginResponse, SignupResponse, User } from "@/types/auth.types";

export const useAuth = () => ({
   signup: async (signupData: { username: string; email: string; password1: string }) => {
      const { data } = await api.post<SignupResponse>("/auth/registration/", signupData);
      useAuthStore.getState().login(data.user, data.access);
      return data;
   },

   login: async (loginData: { email: string; password: string }) => {
      const { data } = await api.post<LoginResponse>("/auth/login/", loginData);
      useAuthStore.getState().login(data.user, data.access);
      return data;
   },

   logout: async () => {
      const res = await api.post("/auth/logout/");
      if (res.status === 200) {
         useAuthStore.getState().logout();
      }
      return res.data;
   },

   user: async () => {
      const { data } = await api.get<User>("/auth/user/");
      // single atomic update — user and isInitialized set together, one render
      useAuthStore.getState().setAuthInitialized(data);
      return data;
   },
});
