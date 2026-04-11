import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "./types.js";

interface AuthState {
   user: User | null;
   accessToken: string | null;
   isAuthenticated: boolean;
   isInitialized: boolean;
   // Actions
   setAuth: (user: User | null) => void;
   setAccessToken: (token: string | null) => void;
   logout: () => void;
   setInitialized: (initialized: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
   persist(
      (set) => ({
         user: null,
         accessToken: null,
         isAuthenticated: false,
         isInitialized: false,

         setAuth: (user) => {
            set({
               user,
               isAuthenticated: !!user,
               isInitialized: true,
            });
         },

         setAccessToken: (token) => {
            set({
               accessToken: token,
               isAuthenticated: !!token,
            });
         },

         logout: () => {
            set({ user: null, accessToken: null, isAuthenticated: false });
         },

         setInitialized: (initialized) => {
            set({ isInitialized: initialized });
         },
      }),
      {
         name: "auth-storage",
         partialize: (state) => ({ user: state.user }),

         onRehydrateStorage: () => (state) => {
            if (state) {
               state.isAuthenticated = !!state.user;
               state.isInitialized = !!state.user;
            }
         },
      },
   ),
);
