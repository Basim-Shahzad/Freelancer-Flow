import { create } from "zustand";
import type { User } from "@/types/auth.types";

interface AuthState {
   user: User | null;
   accessToken: string | null;
   isInitialized: boolean;

   setInitialized: (initialized: boolean) => void;
   setAuth: (user: User) => void;
   setAccessToken: (token: string) => void;
   login: (user: User, accessToken: string) => void;
   logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
   user: null,
   accessToken: null,
   isInitialized: false,
   setInitialized: (initialized) => set({ isInitialized: initialized }),
   setAuth: (user) => set({ user, isInitialized: true }),
   setAccessToken: (token) => set({ accessToken: token }),
   login: (user, accessToken) => set({ user, accessToken }),
   logout: () => set({ user: null, accessToken: null }),
}));
