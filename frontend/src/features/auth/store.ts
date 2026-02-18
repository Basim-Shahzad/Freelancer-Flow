import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "./types.js";

interface AuthState {
   user: User | null;
   isAuthenticated: boolean;
   isInitialized: boolean;
   setAuth: (user: User | null) => void;
   logout: () => void;
   setInitialized: (initialized: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
   persist(
      (set) => ({
         user: null,
         isAuthenticated: false,
         isInitialized: false,

         setAuth: (user) => {
            set({
               user,
               isAuthenticated: !!user,
               isInitialized: true,
            });
         },

         logout: () => {
            set({ user: null, isAuthenticated: false });
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
