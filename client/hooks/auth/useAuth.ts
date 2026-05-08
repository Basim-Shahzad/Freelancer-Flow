import { useAuthStore } from "@/stores/useAuthStore";
import api from "@/services/api.service";
import type { LoginResponse, SignupResponse, User, Tokens } from "@/types/auth.types";

export const useAuth = () => ({
   signup: async (signupData: { username: string; email: string; password1: string }) => {
      const { data } = await api.post<SignupResponse>("/auth/registration/", signupData);
      const login = useAuthStore.getState().login;
      const useAuth = useAuthStore.getState().setAuth;
      useAuth(data.user);
      login(data.user, data.access);
      return data;
   },
   login: async (loginData: { username: string; password: string }) => {
      const { data } = await api.post<LoginResponse>("/auth/login/", loginData);
      const login = useAuthStore.getState().login;
      const useAuth = useAuthStore.getState().setAuth;
      useAuth(data.user);
      login(data.user, data.access);
      return data;
   },
   logout: async () => {
      const logout = useAuthStore.getState().logout;
      const res = await api.post("/auth/logout/");
      if (res.status === 200) {
         logout();
      }
      return res.data;
   },
   user: async () => {
      const res = await api.get<User>("/auth/user/");
      if (res.status !== 200) {
         const useAuth = useAuthStore.getState().setAuth;
         useAuth(res.data);
         return res.data;
      }
      return null;
   },
});
